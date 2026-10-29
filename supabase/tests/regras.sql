-- Testes das regras do banco. Rode no SQL Editor do Supabase.
-- Usa um dia fictício (01/01/1900) e apaga tudo o que criou no final.
-- Resultado: uma tabela com cada teste e "ok" ou "FALHOU".

create temp table if not exists resultado_testes (teste text, resultado text);
truncate resultado_testes;

do $$
declare
  v_prod uuid;
  v_dia uuid;
  v_item uuid;
  v_venda uuid;
begin
  insert into public.produtos (nome, preco_padrao, custo_padrao)
    values ('__teste_regras__', 6, 2.5) returning id into v_prod;
  insert into public.dias (data) values (date '1900-01-01') returning id into v_dia;
  insert into public.itens_dia (dia_id, produto_id, nome, produzido, preco, custo)
    values (v_dia, v_prod, '__teste_regras__', 10, 6, 2.5) returning id into v_item;

  -- 1. Pix sem cliente é recusado
  begin
    insert into public.vendas (item_dia_id, quantidade, valor_cobrado, pagamento, cliente) values (v_item, 1, 6, 'pix', '  ');
    insert into resultado_testes values ('Pix sem cliente é recusado', 'FALHOU');
  exception when check_violation then
    insert into resultado_testes values ('Pix sem cliente é recusado', 'ok');
  end;

  -- 2. Dinheiro sem cliente é aceito
  insert into public.vendas (item_dia_id, quantidade, valor_cobrado, pagamento) values (v_item, 2, 11, 'dinheiro') returning id into v_venda;
  insert into resultado_testes values ('Dinheiro sem cliente é aceito', 'ok');

  -- 3. Fechar sem snapshot é recusado
  begin
    update public.dias set status = 'fechado' where id = v_dia;
    insert into resultado_testes values ('Fechar sem resumo é recusado', 'FALHOU');
  exception when others then
    insert into resultado_testes values ('Fechar sem resumo é recusado', 'ok');
  end;

  update public.dias set status = 'fechado', snapshot = '{"teste": true}' where id = v_dia;

  -- 4. Dia fechado recusa venda nova
  begin
    insert into public.vendas (item_dia_id, quantidade, valor_cobrado, pagamento) values (v_item, 1, 6, 'cartao');
    insert into resultado_testes values ('Dia fechado recusa venda', 'FALHOU');
  exception when raise_exception then
    insert into resultado_testes values ('Dia fechado recusa venda', 'ok');
  end;

  -- 5. Dia fechado recusa edição de venda
  begin
    update public.vendas set valor_cobrado = 1 where id = v_venda;
    insert into resultado_testes values ('Dia fechado recusa edição', 'FALHOU');
  exception when raise_exception then
    insert into resultado_testes values ('Dia fechado recusa edição', 'ok');
  end;

  -- 6. Dia fechado recusa exclusão de venda
  begin
    delete from public.vendas where id = v_venda;
    insert into resultado_testes values ('Dia fechado recusa exclusão', 'FALHOU');
  exception when raise_exception then
    insert into resultado_testes values ('Dia fechado recusa exclusão', 'ok');
  end;

  -- 7. Dia fechado recusa mudar a produção
  begin
    update public.itens_dia set produzido = 99 where id = v_item;
    insert into resultado_testes values ('Dia fechado recusa mudar produção', 'FALHOU');
  exception when raise_exception then
    insert into resultado_testes values ('Dia fechado recusa mudar produção', 'ok');
  end;

  -- 8. Reabrir descarta o snapshot
  update public.dias set status = 'aberto' where id = v_dia;
  insert into resultado_testes
    select 'Reabrir descarta o resumo', case when snapshot is null and fechado_em is null then 'ok' else 'FALHOU' end
    from public.dias where id = v_dia;

  -- 9. Data padrão do dia usa o fuso de Belém
  insert into resultado_testes
    select 'Data padrão no fuso de Belém',
      case when (select column_default from information_schema.columns
                 where table_schema = 'public' and table_name = 'dias' and column_name = 'data') like '%America/Belem%'
           then 'ok' else 'FALHOU' end;

  -- limpeza
  delete from public.dias where id = v_dia;
  delete from public.produtos where id = v_prod;
end $$;

select * from resultado_testes;
