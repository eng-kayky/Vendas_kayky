-- Empada & Pudim: esquema inicial
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tabelas

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(btrim(nome)) > 0),
  preco_padrao numeric(10,2) not null default 0 check (preco_padrao >= 0),
  custo_padrao numeric(10,2) not null default 0 check (custo_padrao >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.dias (
  id uuid primary key default gen_random_uuid(),
  data date not null unique default ((now() at time zone 'America/Belem')::date),
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  aberto_por uuid default auth.uid() references auth.users(id),
  aberto_em timestamptz not null default now(),
  fechado_por uuid references auth.users(id),
  fechado_em timestamptz,
  snapshot jsonb,
  constraint snapshot_quando_fechado check (status = 'aberto' or snapshot is not null)
);

create table public.itens_dia (
  id uuid primary key default gen_random_uuid(),
  dia_id uuid not null references public.dias(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  nome text not null,                       -- cópia do nome no dia
  produzido integer not null check (produzido >= 0),
  preco numeric(10,2) not null check (preco >= 0),
  custo numeric(10,2) not null check (custo >= 0),
  unique (dia_id, produto_id)
);

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  item_dia_id uuid not null references public.itens_dia(id) on delete cascade,
  quantidade integer not null check (quantidade > 0),
  valor_cobrado numeric(10,2) not null check (valor_cobrado >= 0),
  pagamento text not null check (pagamento in ('pix','dinheiro','cartao')),
  cliente text,
  criado_por uuid default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  constraint cliente_obrigatorio_no_pix
    check (pagamento <> 'pix' or length(btrim(coalesce(cliente,''))) > 0)
);

create index itens_dia_dia_idx on public.itens_dia (dia_id);
create index itens_dia_produto_idx on public.itens_dia (produto_id);
create index vendas_item_idx on public.vendas (item_dia_id);
create index vendas_criado_em_idx on public.vendas (criado_em desc);

-- ---------------------------------------------------------------- bloqueio de dia fechado

create or replace function public.status_do_dia(p_dia uuid) returns text
language sql stable set search_path = '' as $$
  select status from public.dias where id = p_dia
$$;

create or replace function public.status_do_item(p_item uuid) returns text
language sql stable set search_path = '' as $$
  select d.status from public.itens_dia i join public.dias d on d.id = i.dia_id where i.id = p_item
$$;

-- itens_dia e vendas: confere o dia de origem (OLD) e o de destino (NEW)
create or replace function public.bloquear_dia_fechado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'vendas' then
    if (tg_op <> 'INSERT' and public.status_do_item(old.item_dia_id) = 'fechado')
       or (tg_op <> 'DELETE' and public.status_do_item(new.item_dia_id) = 'fechado') then
      raise exception 'Dia fechado: reabra o dia para alterar.';
    end if;
  else
    if (tg_op <> 'INSERT' and public.status_do_dia(old.dia_id) = 'fechado')
       or (tg_op <> 'DELETE' and public.status_do_dia(new.dia_id) = 'fechado') then
      raise exception 'Dia fechado: reabra o dia para alterar.';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_vendas_bloqueio before insert or update or delete on public.vendas
  for each row execute function public.bloquear_dia_fechado();
create trigger trg_itens_bloqueio before insert or update or delete on public.itens_dia
  for each row execute function public.bloquear_dia_fechado();

-- dias: fechado só pode ser reaberto; ao fechar, exige snapshot e registra quem/quando
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
    -- reabrir: descarta o snapshot
    new.snapshot := null;
    new.fechado_em := null;
    new.fechado_por := null;
    return new;
  end if;

  if new.status = 'fechado' then
    if new.snapshot is null then
      raise exception 'Para fechar o dia é preciso gravar o resumo.';
    end if;
    new.fechado_em := now();
    new.fechado_por := auth.uid();
  else
    new.snapshot := null;
  end if;
  return new;
end $$;

create trigger trg_dias_protecao before update or delete on public.dias
  for each row execute function public.proteger_dia();

-- ---------------------------------------------------------------- abrir o dia (atômico)

-- p_itens: [{ "produto_id": uuid, "produzido": int, "preco": numeric, "custo": numeric }]
create or replace function public.abrir_dia(p_itens jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_dia uuid;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos um produto.';
  end if;

  insert into public.dias default values returning id into v_dia;

  insert into public.itens_dia (dia_id, produto_id, nome, produzido, preco, custo)
  select v_dia, p.id, p.nome, (x->>'produzido')::int, (x->>'preco')::numeric, (x->>'custo')::numeric
  from jsonb_array_elements(p_itens) x
  join public.produtos p on p.id = (x->>'produto_id')::uuid;

  -- o preço e o custo do dia viram o padrão do produto
  update public.produtos p
     set preco_padrao = (x->>'preco')::numeric, custo_padrao = (x->>'custo')::numeric
    from jsonb_array_elements(p_itens) x
   where p.id = (x->>'produto_id')::uuid;

  return v_dia;
end $$;

-- ---------------------------------------------------------------- views

-- Totais por item (respeita a RLS de quem consulta)
create view public.resumo_itens_dia with (security_invoker = true) as
select i.id as item_dia_id, i.dia_id, i.nome, i.produzido, i.preco, i.custo,
       coalesce(sum(v.quantidade), 0)::int as vendido,
       coalesce(sum(v.valor_cobrado), 0)::numeric(10,2) as faturado,
       coalesce(sum(v.quantidade * i.preco), 0)::numeric(10,2) as bruto
from public.itens_dia i left join public.vendas v on v.item_dia_id = i.id
group by i.id;

-- Valores do último dia em que cada produto foi usado (para pré-preencher "Abrir o dia")
create view public.ultimos_valores with (security_invoker = true) as
select distinct on (i.produto_id)
       i.produto_id, i.produzido, i.preco, i.custo, d.data
from public.itens_dia i join public.dias d on d.id = i.dia_id
order by i.produto_id, d.data desc;

-- ---------------------------------------------------------------- RLS e permissões

alter table public.produtos  enable row level security;
alter table public.dias      enable row level security;
alter table public.itens_dia enable row level security;
alter table public.vendas    enable row level security;

create policy autenticados on public.produtos  for all to authenticated using (true) with check (true);
create policy autenticados on public.dias      for all to authenticated using (true) with check (true);
create policy autenticados on public.itens_dia for all to authenticated using (true) with check (true);
create policy autenticados on public.vendas    for all to authenticated using (true) with check (true);

-- Sem login (chave anon) não há acesso nenhum: nem leitura nem escrita
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;

grant select, insert, update, delete on public.produtos, public.dias, public.itens_dia, public.vendas to authenticated;
grant select on public.resumo_itens_dia, public.ultimos_valores to authenticated;
grant execute on function public.abrir_dia(jsonb), public.status_do_dia(uuid), public.status_do_item(uuid) to authenticated;
