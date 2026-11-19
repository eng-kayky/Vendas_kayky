-- 0006: corrigir o valor de uma venda direto da janela da venda (Fiado, ficha do cliente,
-- lista do dia), sem precisar reabrir o dia. Vale também para dia fechado.
-- Muda só quantidades, preços e desconto; o dia da venda é recalculado sozinho.
begin;

-- As travas de dia fechado deixam passar quando a mudança vem de editar_venda().
create or replace function public.bloquear_pedido_fechado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('app.editar_venda', true) = 'on' then
    return coalesce(new, old);
  end if;
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
  if current_setting('app.editar_venda', true) = 'on' then
    return coalesce(new, old);
  end if;
  if (tg_op <> 'INSERT' and public.status_do_pedido(old.pedido_id) = 'fechado')
     or (tg_op <> 'DELETE' and public.status_do_pedido(new.pedido_id) = 'fechado') then
    raise exception 'Dia fechado: reabra o dia para alterar.';
  end if;
  return coalesce(new, old);
end $$;

-- p_itens: [{ "item_dia_id": uuid, "quantidade": int, "preco_unit": numeric }]
-- p_desconto: positivo = desconto, negativo = acréscimo
create or replace function public.editar_venda(p_pedido uuid, p_itens jsonb, p_desconto numeric default 0)
returns numeric -- novo total
language plpgsql security invoker set search_path = '' as $$
declare
  v_dia uuid;
  v_status text;
  v_subtotal numeric;
  v_total numeric;
  v_pago numeric;
begin
  select dia_id, status into v_dia, v_status from public.pedidos where id = p_pedido;
  if not found then raise exception 'Venda não encontrada (talvez tenha sido desfeita).'; end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda precisa de ao menos um produto.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) i
    where coalesce((i ->> 'quantidade')::int, 0) < 1 or coalesce((i ->> 'preco_unit')::numeric, -1) < 0
  ) then
    raise exception 'Quantidade precisa ser 1 ou mais e o preço não pode ser negativo.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) i
    where not exists (select 1 from public.itens_dia d where d.id = (i ->> 'item_dia_id')::uuid and d.dia_id = v_dia)
  ) then
    raise exception 'Produto não pertence ao dia desta venda.';
  end if;

  select sum((i ->> 'quantidade')::int * (i ->> 'preco_unit')::numeric) into v_subtotal
  from jsonb_array_elements(p_itens) i;
  v_total := v_subtotal - coalesce(p_desconto, 0);
  if v_total < 0 then raise exception 'O desconto não pode ser maior que o total.'; end if;

  select coalesce(sum(valor), 0) into v_pago from public.fiado_recebimentos where pedido_id = p_pedido;
  if v_pago > v_total then
    raise exception 'O cliente já pagou R$ % desta venda; o total não pode ficar menor que isso.', to_char(v_pago, 'FM999990D00');
  end if;

  perform set_config('app.editar_venda', 'on', true);
  update public.pedidos set desconto = coalesce(p_desconto, 0), total = v_total where id = p_pedido;
  delete from public.pedido_itens where pedido_id = p_pedido;
  insert into public.pedido_itens (pedido_id, item_dia_id, quantidade, preco_unit, subtotal)
  select p_pedido, (i ->> 'item_dia_id')::uuid, (i ->> 'quantidade')::int, (i ->> 'preco_unit')::numeric,
         (i ->> 'quantidade')::int * (i ->> 'preco_unit')::numeric
  from jsonb_array_elements(p_itens) i;
  perform public.recalcular_fiado(p_pedido);
  perform set_config('app.editar_venda', 'off', true);
  return v_total;
end $$;

revoke all on function public.editar_venda(uuid, jsonb, numeric) from anon, public;
grant execute on function public.editar_venda(uuid, jsonb, numeric) to authenticated;

commit;

select 'editar_venda pronta' as conferencia;
