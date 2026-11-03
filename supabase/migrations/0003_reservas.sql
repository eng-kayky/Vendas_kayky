-- Reserva: o cliente pede para separar; as unidades saem do disponível, mas ainda não é venda.
-- Ao entregar, a reserva vira venda (status 'concluida') com a forma de pagamento.

alter table public.vendas add column if not exists status text not null default 'concluida';
alter table public.vendas drop constraint if exists vendas_status_check;
alter table public.vendas add constraint vendas_status_check check (status in ('concluida','reservada'));

-- Reserva ainda não tem forma de pagamento; venda concluída precisa ter
alter table public.vendas alter column pagamento drop not null;
alter table public.vendas drop constraint if exists pagamento_obrigatorio_na_venda;
alter table public.vendas add constraint pagamento_obrigatorio_na_venda
  check (status = 'reservada' or pagamento is not null);

-- Reserva precisa do nome de quem vai buscar
alter table public.vendas drop constraint if exists cliente_obrigatorio_na_reserva;
alter table public.vendas add constraint cliente_obrigatorio_na_reserva
  check (status <> 'reservada' or length(btrim(coalesce(cliente,''))) > 0);

-- Totais por item contam só vendas concluídas
create or replace view public.resumo_itens_dia with (security_invoker = true) as
select i.id as item_dia_id, i.dia_id, i.nome, i.produzido, i.preco, i.custo,
       coalesce(sum(v.quantidade) filter (where v.status = 'concluida'), 0)::int as vendido,
       coalesce(sum(v.valor_cobrado) filter (where v.status = 'concluida'), 0)::numeric(10,2) as faturado,
       coalesce(sum(v.quantidade * i.preco) filter (where v.status = 'concluida'), 0)::numeric(10,2) as bruto
from public.itens_dia i left join public.vendas v on v.item_dia_id = i.id
group by i.id;
