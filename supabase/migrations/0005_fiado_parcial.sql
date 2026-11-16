-- =====================================================================================
-- 0005 · Fiado com pagamento parcial ("deu um valor por conta")
--
-- Cada pagamento vira um "lote" que abate a dívida do cliente começando pela compra mais
-- antiga. Uma compra fica quitada (pedidos.fiado_pago_em/com) quando os pagamentos dela
-- somam o total. Os pagamentos já registrados são copiados como pagamentos integrais.
-- Rode uma vez só, inteiro, no SQL Editor do Supabase.
-- =====================================================================================

begin;

create table public.fiado_recebimentos (
  id uuid primary key default gen_random_uuid(),
  lote uuid not null,                      -- um pagamento do cliente (pode abater várias compras)
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  cliente_id uuid references public.clientes(id),
  valor numeric(10,2) not null check (valor > 0),
  forma text not null check (forma in ('pix','dinheiro','cartao')),
  data date not null default ((now() at time zone 'America/Belem')::date),
  criado_por uuid default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now()
);
create index fiado_recebimentos_pedido_idx on public.fiado_recebimentos (pedido_id);
create index fiado_recebimentos_lote_idx on public.fiado_recebimentos (lote);
create index fiado_recebimentos_cliente_idx on public.fiado_recebimentos (cliente_id);

-- pagamentos que já existiam viram pagamentos integrais
insert into public.fiado_recebimentos (lote, pedido_id, cliente_id, valor, forma, data)
select gen_random_uuid(), p.id, p.cliente_id, p.total, p.fiado_pago_com, p.fiado_pago_em
from public.pedidos p
where p.pagamento = 'fiado' and p.fiado_pago_em is not null and p.total > 0;

-- Marca a compra como quitada (ou não) conforme o que já foi pago nela.
create or replace function public.recalcular_fiado(p_pedido uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_total numeric;
  v_pago numeric;
  v_ultimo record;
begin
  select total into v_total from public.pedidos where id = p_pedido and pagamento = 'fiado';
  if not found then return; end if;
  select coalesce(sum(valor), 0) into v_pago from public.fiado_recebimentos where pedido_id = p_pedido;
  if v_pago >= v_total and v_pago > 0 then
    select data, forma into v_ultimo from public.fiado_recebimentos where pedido_id = p_pedido order by data desc, criado_em desc limit 1;
    update public.pedidos set fiado_pago_em = v_ultimo.data, fiado_pago_com = v_ultimo.forma where id = p_pedido;
  else
    update public.pedidos set fiado_pago_em = null, fiado_pago_com = null where id = p_pedido and fiado_pago_em is not null;
  end if;
end $$;

-- Recebe um valor do cliente e abate das compras fiado em aberto, da mais antiga para a mais nova.
-- p_pedidos: limita a essas compras (null = todas as do cliente). Recusa valor maior que a dívida.
create or replace function public.receber_fiado(p_cliente uuid, p_valor numeric, p_forma text, p_data date default null, p_pedidos uuid[] default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_lote uuid := gen_random_uuid();
  v_resto numeric := p_valor;
  v_data date := coalesce(p_data, (now() at time zone 'America/Belem')::date);
  v_aberto numeric;
  c record;
  v_parte numeric;
begin
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
  if p_forma not in ('pix','dinheiro','cartao') then raise exception 'Forma de pagamento inválida.'; end if;

  for c in
    select p.id, p.total - coalesce((select sum(r.valor) from public.fiado_recebimentos r where r.pedido_id = p.id), 0) as falta
    from public.pedidos p join public.dias d on d.id = p.dia_id
    where p.cliente_id = p_cliente and p.pagamento = 'fiado' and p.status = 'concluido'
      and (p_pedidos is null or p.id = any(p_pedidos))
    order by d.data, p.criado_em
  loop
    continue when c.falta <= 0;
    exit when v_resto <= 0;
    v_parte := least(c.falta, v_resto);
    insert into public.fiado_recebimentos (lote, pedido_id, cliente_id, valor, forma, data)
    values (v_lote, c.id, p_cliente, v_parte, p_forma, v_data);
    v_resto := v_resto - v_parte;
    perform public.recalcular_fiado(c.id);
  end loop;

  if v_resto > 0 then
    raise exception 'O valor é maior que o que falta pagar (sobram R$ %).', to_char(v_resto, 'FM999990D00');
  end if;
  return v_lote;
end $$;

-- Desfaz um pagamento inteiro (todas as compras que ele abateu voltam a dever).
create or replace function public.desfazer_recebimento(p_lote uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_pedidos uuid[];
  v_id uuid;
begin
  select array_agg(distinct pedido_id) into v_pedidos from public.fiado_recebimentos where lote = p_lote;
  if v_pedidos is null then raise exception 'Pagamento não encontrado.'; end if;
  delete from public.fiado_recebimentos where lote = p_lote;
  foreach v_id in array v_pedidos loop
    perform public.recalcular_fiado(v_id);
  end loop;
end $$;

-- Troca a forma de um pagamento (se registrou errado).
create or replace function public.trocar_forma_recebimento(p_lote uuid, p_forma text) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_forma not in ('pix','dinheiro','cartao') then raise exception 'Forma de pagamento inválida.'; end if;
  update public.fiado_recebimentos set forma = p_forma where lote = p_lote;
  for v_id in select distinct pedido_id from public.fiado_recebimentos where lote = p_lote loop
    perform public.recalcular_fiado(v_id);
  end loop;
end $$;

-- Editar uma venda fiado que já recebeu pagamento: não pode trocar a forma nem ficar menor que o pago.
create or replace function public.salvar_pedido(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_nome text := nullif(btrim(coalesce(p ->> 'cliente', '')), '');
  v_cliente uuid;
  v_subtotal numeric;
  v_desconto numeric := coalesce((p ->> 'desconto')::numeric, 0);
  v_status text := coalesce(p ->> 'status', 'concluido');
  v_pagamento text := case when v_status = 'reservado' then null else nullif(p ->> 'pagamento', '') end;
  v_pago numeric;
begin
  if jsonb_typeof(p -> 'itens') <> 'array' or jsonb_array_length(p -> 'itens') = 0 then
    raise exception 'Escolha ao menos um produto.';
  end if;

  if v_nome is not null then
    insert into public.clientes (nome) values (v_nome)
      on conflict (nome_chave) do update set nome = public.clientes.nome
      returning id into v_cliente;
  end if;

  select coalesce(sum((i ->> 'quantidade')::int * (i ->> 'preco_unit')::numeric), 0) into v_subtotal
  from jsonb_array_elements(p -> 'itens') i;
  if v_subtotal - v_desconto < 0 then
    raise exception 'O desconto não pode ser maior que o total.';
  end if;

  if v_id is null then
    insert into public.pedidos (dia_id, cliente_id, status, pagamento, desconto, total, observacao, criado_em)
    values ((p ->> 'dia_id')::uuid, v_cliente, v_status, v_pagamento, v_desconto, v_subtotal - v_desconto,
            nullif(p ->> 'observacao', ''), coalesce(nullif(p ->> 'criado_em', '')::timestamptz, now()))
    returning id into v_id;
  else
    if not exists (select 1 from public.pedidos where id = v_id) then raise exception 'Venda não encontrada.'; end if;
    select coalesce(sum(valor), 0) into v_pago from public.fiado_recebimentos where pedido_id = v_id;
    if v_pago > 0 and v_pagamento is distinct from 'fiado' then
      raise exception 'Esse fiado já recebeu pagamento. Desfaça os pagamentos antes de trocar a forma.';
    end if;
    if v_pago > v_subtotal - v_desconto then
      raise exception 'O cliente já pagou R$ % desta venda; o total não pode ficar menor que isso.', to_char(v_pago, 'FM999990D00');
    end if;
    update public.pedidos
       set cliente_id = v_cliente, status = v_status, pagamento = v_pagamento, desconto = v_desconto,
           total = v_subtotal - v_desconto, observacao = nullif(p ->> 'observacao', '')
     where id = v_id;
    delete from public.pedido_itens where pedido_id = v_id;
  end if;

  insert into public.pedido_itens (pedido_id, item_dia_id, quantidade, preco_unit, subtotal)
  select v_id, (i ->> 'item_dia_id')::uuid, (i ->> 'quantidade')::int, (i ->> 'preco_unit')::numeric,
         (i ->> 'quantidade')::int * (i ->> 'preco_unit')::numeric
  from jsonb_array_elements(p -> 'itens') i;

  perform public.recalcular_fiado(v_id);
  return v_id;
end $$;

-- segurança
alter table public.fiado_recebimentos enable row level security;
create policy autenticados on public.fiado_recebimentos for all to authenticated using (true) with check (true);
revoke all on public.fiado_recebimentos from anon;
grant select, insert, update, delete on public.fiado_recebimentos to authenticated;
revoke all on function public.recalcular_fiado(uuid), public.receber_fiado(uuid, numeric, text, date, uuid[]),
  public.desfazer_recebimento(uuid), public.trocar_forma_recebimento(uuid, text) from anon, public;
grant execute on function public.recalcular_fiado(uuid), public.receber_fiado(uuid, numeric, text, date, uuid[]),
  public.desfazer_recebimento(uuid), public.trocar_forma_recebimento(uuid, text) to authenticated;

commit;

-- Conferência: as duas contagens devem bater
select 'fiados pagos → pagamentos' as conferencia,
       (select count(*) from public.pedidos where pagamento = 'fiado' and fiado_pago_em is not null and total > 0) as antes,
       (select count(*) from public.fiado_recebimentos) as depois;
