-- =====================================================================================
-- 0004 · Reestruturação: venda de produtos em geral
--
--  • clientes cadastrados (sem duplicar "Ana" e "ana")
--  • pedidos com vários produtos (carrinho), desconto e pagamento por pedido
--  • fiado pago guardado no próprio pedido (aparece no dia da venda)
--  • gasto do dia guardado no dia (o resumo é calculado na hora, sem "foto")
--  • produto com unidade e categoria; quantidade do dia opcional (sem controle de estoque)
--  • abrir dia em qualquer data (hoje ou anterior)
--
-- Os dados atuais são COPIADOS para a estrutura nova. As tabelas antigas (vendas,
-- fiado_pagamentos) e a coluna dias.snapshot ficam intactas, como backup.
-- Rode uma vez só, inteiro, no SQL Editor do Supabase.
-- =====================================================================================

begin;

-- ---------------------------------------------------------------- produtos
alter table public.produtos add column if not exists unidade text not null default 'un';
alter table public.produtos add column if not exists categoria text;

-- ---------------------------------------------------------------- clientes
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  nome_chave text generated always as (lower(btrim(nome))) stored unique,
  telefone text,
  criado_em timestamptz not null default now()
);

insert into public.clientes (nome)
select distinct on (lower(btrim(cliente))) btrim(cliente)
from public.vendas
where cliente is not null and btrim(cliente) <> ''
order by lower(btrim(cliente)), criado_em desc
on conflict (nome_chave) do nothing;

-- ---------------------------------------------------------------- dias
alter table public.dias add column if not exists gasto numeric(10,2) check (gasto >= 0);
alter table public.dias add column if not exists sem_gasto boolean not null default false;
alter table public.dias drop constraint if exists snapshot_quando_fechado;

-- gasto que estava no resumo gravado
alter table public.dias disable trigger trg_dias_protecao;
update public.dias
   set gasto = nullif(snapshot #>> '{totais,gasto}', '')::numeric,
       sem_gasto = (snapshot #>> '{totais,gasto}') is null
 where snapshot is not null;

-- ---------------------------------------------------------------- itens do dia
alter table public.itens_dia alter column produzido drop not null; -- vazio = sem controle de estoque
alter table public.itens_dia alter column custo set default 0;

-- ---------------------------------------------------------------- pedidos
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  dia_id uuid not null references public.dias(id) on delete cascade,
  cliente_id uuid references public.clientes(id),
  status text not null default 'concluido' check (status in ('concluido','reservado')),
  pagamento text check (pagamento in ('pix','dinheiro','cartao','fiado','nao_informado')),
  desconto numeric(10,2) not null default 0, -- negativo = acréscimo
  total numeric(10,2) not null check (total >= 0), -- valor cobrado
  observacao text,
  fiado_pago_em date,
  fiado_pago_com text check (fiado_pago_com in ('pix','dinheiro','cartao')),
  criado_por uuid default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  constraint pagamento_na_venda check (status = 'reservado' or pagamento is not null),
  -- Pix, fiado e reserva exigem cliente (exceto os dias antigos lançados só com totais)
  constraint cliente_no_pix_fiado_reserva check (
    cliente_id is not null
    or (status = 'concluido' and pagamento not in ('pix','fiado'))
    or (status = 'concluido' and pagamento = 'pix' and coalesce(observacao, '') = 'Lançado por resumo')
  ),
  constraint fiado_pago_coerente check (
    (fiado_pago_em is null and fiado_pago_com is null)
    or (pagamento = 'fiado' and fiado_pago_em is not null and fiado_pago_com is not null)
  )
);
create index pedidos_dia_idx on public.pedidos (dia_id);
create index pedidos_cliente_idx on public.pedidos (cliente_id);
create index pedidos_fiado_idx on public.pedidos (pagamento) where pagamento = 'fiado';

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  item_dia_id uuid not null references public.itens_dia(id) on delete cascade,
  quantidade integer not null check (quantidade > 0),
  preco_unit numeric(10,2) not null check (preco_unit >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0)
);
create index pedido_itens_pedido_idx on public.pedido_itens (pedido_id);
create index pedido_itens_item_idx on public.pedido_itens (item_dia_id);

-- ---------------------------------------------------------------- cópia das vendas antigas
-- cada venda antiga vira um pedido de um produto (mesmo id, para não perder a ligação com o fiado)
insert into public.pedidos (id, dia_id, cliente_id, status, pagamento, desconto, total, criado_por, criado_em, fiado_pago_em, fiado_pago_com)
select v.id,
       i.dia_id,
       c.id,
       case when v.status = 'reservada' then 'reservado' else 'concluido' end,
       v.pagamento,
       v.quantidade * i.preco - v.valor_cobrado,
       v.valor_cobrado,
       v.criado_por,
       v.criado_em,
       fp.data,
       fp.pagamento
from public.vendas v
join public.itens_dia i on i.id = v.item_dia_id
left join public.clientes c on c.nome_chave = lower(btrim(v.cliente))
left join public.fiado_pagamentos fp on fp.venda_id = v.id;

insert into public.pedido_itens (pedido_id, item_dia_id, quantidade, preco_unit, subtotal)
select v.id, v.item_dia_id, v.quantidade, i.preco, v.quantidade * i.preco
from public.vendas v
join public.itens_dia i on i.id = v.item_dia_id;

-- dias lançados "por resumo" (só totais): viram itens do dia + um pedido sem nome por produto
alter table public.itens_dia disable trigger trg_itens_bloqueio;
do $$
declare
  d record;
  it jsonb;
  v_prod uuid;
  v_item uuid;
  v_pedido uuid;
  v_preco numeric;
  v_vend int;
  v_fat numeric;
  v_pg text;
  v_liq numeric;
begin
  for d in
    select * from public.dias
    where snapshot ->> 'tipo' = 'resumo'
      and not exists (select 1 from public.itens_dia x where x.dia_id = dias.id)
  loop
    -- forma de pagamento: só dá para saber se uma única forma cobriu o dia inteiro
    v_liq := coalesce((d.snapshot #>> '{totais,liquido}')::numeric, 0);
    v_pg := 'nao_informado';
    if coalesce((d.snapshot #>> '{pagamentos,pix}')::numeric, 0) = v_liq and v_liq > 0 then v_pg := 'pix';
    elsif coalesce((d.snapshot #>> '{pagamentos,dinheiro}')::numeric, 0) = v_liq and v_liq > 0 then v_pg := 'dinheiro';
    elsif coalesce((d.snapshot #>> '{pagamentos,cartao}')::numeric, 0) = v_liq and v_liq > 0 then v_pg := 'cartao';
    end if;

    for it in select * from jsonb_array_elements(d.snapshot -> 'itens') loop
      v_vend := coalesce((it ->> 'vendido')::int, 0);
      v_fat := coalesce((it ->> 'faturado')::numeric, 0);
      v_preco := case when v_vend > 0 then round(v_fat / v_vend, 2) else 0 end;

      select id into v_prod from public.produtos where lower(btrim(nome)) = lower(btrim(it ->> 'nome'));
      if v_prod is null then
        insert into public.produtos (nome, preco_padrao, custo_padrao, ativo)
        values (btrim(it ->> 'nome'), v_preco, 0, false) returning id into v_prod;
      end if;

      insert into public.itens_dia (dia_id, produto_id, nome, produzido, preco, custo)
      values (d.id, v_prod, it ->> 'nome', nullif((it ->> 'produzido')::int, 0), v_preco, 0)
      returning id into v_item;

      if v_vend > 0 then
        insert into public.pedidos (dia_id, status, pagamento, desconto, total, observacao, criado_em)
        values (d.id, 'concluido', v_pg, v_vend * v_preco - v_fat, v_fat, 'Lançado por resumo', (d.data::text || 'T15:00:00Z')::timestamptz)
        returning id into v_pedido;
        insert into public.pedido_itens (pedido_id, item_dia_id, quantidade, preco_unit, subtotal)
        values (v_pedido, v_item, v_vend, v_preco, v_vend * v_preco);
      end if;
    end loop;
  end loop;
end $$;
alter table public.itens_dia enable trigger trg_itens_bloqueio;

-- ---------------------------------------------------------------- backup das tabelas antigas
-- vendas e fiado_pagamentos ficam guardadas, mas soltas dos dias: excluir um dia não mexe no backup
alter table public.vendas drop constraint if exists vendas_item_dia_id_fkey;
drop trigger if exists trg_vendas_bloqueio on public.vendas;
-- o app não usa mais as tabelas antigas
revoke insert, update, delete on public.vendas, public.fiado_pagamentos from authenticated;

-- ---------------------------------------------------------------- regras de dia fechado
-- dias: fechar exige o gasto (valor ou "não teve"); fechado só pode ser reaberto
create or replace function public.proteger_dia() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'fechado' then
      raise exception 'Dia fechado: reabra o dia para alterar.';
    end if;
    return old;
  end if;

  if new.data <> old.data then
    raise exception 'A data do dia não pode ser alterada.';
  end if;

  if old.status = 'fechado' then
    if new.status <> 'aberto' then
      raise exception 'Dia fechado: reabra o dia para alterar.';
    end if;
    new.fechado_em := null;
    new.fechado_por := null;
    return new;
  end if;

  if new.status = 'fechado' then
    if new.gasto is null and not new.sem_gasto then
      raise exception 'Informe o gasto do dia (ou marque que não teve gasto) para fechar.';
    end if;
    new.fechado_em := now();
    new.fechado_por := auth.uid();
  end if;
  return new;
end $$;
alter table public.dias enable trigger trg_dias_protecao;

create or replace function public.status_do_pedido(p_pedido uuid) returns text
language sql stable set search_path = '' as $$
  select d.status from public.pedidos p join public.dias d on d.id = p.dia_id where p.id = p_pedido
$$;

-- pedidos: dia fechado não aceita mudança, exceto registrar o pagamento de um fiado
create or replace function public.bloquear_pedido_fechado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'fiado_pago_em' - 'fiado_pago_com') = (to_jsonb(old) - 'fiado_pago_em' - 'fiado_pago_com') then
    return new; -- só o pagamento do fiado mudou
  end if;
  if (tg_op <> 'INSERT' and public.status_do_dia(old.dia_id) = 'fechado')
     or (tg_op <> 'DELETE' and public.status_do_dia(new.dia_id) = 'fechado') then
    raise exception 'Dia fechado: reabra o dia para alterar.';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.bloquear_item_pedido_fechado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (tg_op <> 'INSERT' and public.status_do_pedido(old.pedido_id) = 'fechado')
     or (tg_op <> 'DELETE' and public.status_do_pedido(new.pedido_id) = 'fechado') then
    raise exception 'Dia fechado: reabra o dia para alterar.';
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_pedidos_bloqueio before insert or update or delete on public.pedidos
  for each row execute function public.bloquear_pedido_fechado();
create trigger trg_pedido_itens_bloqueio before insert or update or delete on public.pedido_itens
  for each row execute function public.bloquear_item_pedido_fechado();

-- ---------------------------------------------------------------- funções do app
-- Abre um dia em qualquer data até hoje (hoje por padrão).
-- p_itens: [{ "produto_id", "produzido" (ou null), "preco" }]
create or replace function public.abrir_dia_em(p_data date, p_itens jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_dia uuid;
  v_data date := coalesce(p_data, (now() at time zone 'America/Belem')::date);
begin
  if v_data > (now() at time zone 'America/Belem')::date then
    raise exception 'Não dá para abrir um dia no futuro.';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Escolha ao menos um produto.';
  end if;

  insert into public.dias (data) values (v_data) returning id into v_dia;

  insert into public.itens_dia (dia_id, produto_id, nome, produzido, preco, custo)
  select v_dia, p.id, p.nome, nullif(x ->> 'produzido', '')::int, (x ->> 'preco')::numeric, 0
  from jsonb_array_elements(p_itens) x
  join public.produtos p on p.id = (x ->> 'produto_id')::uuid;

  update public.produtos p set preco_padrao = (x ->> 'preco')::numeric
    from jsonb_array_elements(p_itens) x
   where p.id = (x ->> 'produto_id')::uuid;

  return v_dia;
end $$;

-- Cria ou altera um pedido com seus itens, numa operação só.
-- p: { id?, dia_id, cliente (nome)?, status, pagamento?, desconto, observacao?, criado_em?,
--      itens: [{ item_dia_id, quantidade, preco_unit }] }
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
  v_antigo record;
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
    select * into v_antigo from public.pedidos where id = v_id;
    if not found then raise exception 'Venda não encontrada.'; end if;
    if v_antigo.fiado_pago_em is not null and v_pagamento is distinct from 'fiado' then
      raise exception 'Esse fiado já foi recebido. Desfaça o recebimento antes de trocar a forma de pagamento.';
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

  return v_id;
end $$;

-- ---------------------------------------------------------------- segurança
alter table public.clientes enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
create policy autenticados on public.clientes for all to authenticated using (true) with check (true);
create policy autenticados on public.pedidos for all to authenticated using (true) with check (true);
create policy autenticados on public.pedido_itens for all to authenticated using (true) with check (true);

revoke all on public.clientes, public.pedidos, public.pedido_itens from anon;
revoke all on function public.abrir_dia_em(date, jsonb), public.salvar_pedido(jsonb), public.status_do_pedido(uuid),
  public.bloquear_pedido_fechado(), public.bloquear_item_pedido_fechado() from anon, public;
grant select, insert, update, delete on public.clientes, public.pedidos, public.pedido_itens to authenticated;
grant execute on function public.abrir_dia_em(date, jsonb), public.salvar_pedido(jsonb), public.status_do_pedido(uuid) to authenticated;

commit;

-- Conferência: as duas contagens de cada linha devem bater
select 'vendas antigas → pedidos' as conferencia,
       (select count(*) from public.vendas) as antes,
       (select count(*) from public.pedidos where observacao is distinct from 'Lançado por resumo') as depois
union all
select 'fiados pagos', (select count(*) from public.fiado_pagamentos), (select count(*) from public.pedidos where fiado_pago_em is not null)
union all
select 'clientes', (select count(distinct lower(btrim(cliente))) from public.vendas where btrim(coalesce(cliente,'')) <> ''), (select count(*) from public.clientes);
