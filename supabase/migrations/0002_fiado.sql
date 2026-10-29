-- Venda fiado: entra no faturamento do dia da venda e fica "a receber" até o cliente pagar.
-- O pagamento é registrado à parte (o dia da venda pode já estar fechado) e quita a venda inteira.

-- 1. "fiado" como forma de pagamento; cliente obrigatório no Pix e no fiado
alter table public.vendas drop constraint if exists vendas_pagamento_check;
alter table public.vendas add constraint vendas_pagamento_check
  check (pagamento in ('pix','dinheiro','cartao','fiado'));

alter table public.vendas drop constraint if exists cliente_obrigatorio_no_pix;
alter table public.vendas add constraint cliente_obrigatorio_no_pix
  check (pagamento not in ('pix','fiado') or length(btrim(coalesce(cliente,''))) > 0);

-- 2. Recebimento do fiado (um por venda: quita tudo de uma vez)
create table public.fiado_pagamentos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null unique references public.vendas(id) on delete restrict,
  valor numeric(10,2) not null check (valor >= 0),
  pagamento text not null check (pagamento in ('pix','dinheiro','cartao')),
  data date not null default ((now() at time zone 'America/Belem')::date),
  criado_por uuid default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now()
);
create index fiado_pagamentos_data_idx on public.fiado_pagamentos (data);

-- Só venda fiado pode ser recebida
create or replace function public.conferir_fiado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select pagamento from public.vendas where id = new.venda_id) is distinct from 'fiado' then
    raise exception 'Só vendas fiado podem ser recebidas.';
  end if;
  return new;
end $$;

create trigger trg_conferir_fiado before insert or update on public.fiado_pagamentos
  for each row execute function public.conferir_fiado();

-- 3. Segurança: igual às outras tabelas (só usuários logados)
alter table public.fiado_pagamentos enable row level security;
create policy autenticados on public.fiado_pagamentos for all to authenticated using (true) with check (true);
revoke all on public.fiado_pagamentos from anon;
revoke all on function public.conferir_fiado() from anon, public;
grant select, insert, update, delete on public.fiado_pagamentos to authenticated;
