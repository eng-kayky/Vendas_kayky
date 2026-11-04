// Testa as migrações num Postgres local (PGlite) com dados parecidos com os reais.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const dir = process.argv[2] // pasta supabase/migrations
process.on('unhandledRejection', (e) => {
  console.error('ERRO:', e.message, e.detail ?? '', e.where ?? '')
  process.exit(1)
})
const db = new PGlite()
const ok = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exitCode = 1 } else console.log('ok:', m) }
const q = async (s, p) => (await db.query(s, p)).rows

// Imitação do que o Supabase tem
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
`)

for (const f of ['0001_init.sql', '0002_fiado.sql', '0003_reservas.sql']) {
  // PGlite não tem pgcrypto; gen_random_uuid() já vem no Postgres
  await db.exec(readFileSync(`${dir}/${f}`, 'utf8').replace(/create extension[^;]*;/i, ''))
  console.log('aplicada', f)
}

// ---- dados de antes da reestruturação
await db.exec(`
  insert into produtos (id, nome, preco_padrao) values
    ('00000000-0000-0000-0000-0000000000f1','Empada de frango',6),
    ('00000000-0000-0000-0000-0000000000f2','Pudim',5);
  -- dia 29/10 com vendas, fiado pago e a receber, depois fechado
  insert into dias (id, data) values ('00000000-0000-0000-0000-0000000000d1','2026-10-29');
  insert into itens_dia (id, dia_id, produto_id, nome, produzido, preco, custo) values
    ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','Empada de frango',14,6,0),
    ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f2','Pudim',9,5,0);
  insert into vendas (id, item_dia_id, quantidade, valor_cobrado, pagamento, cliente, status) values
    ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1',2,12,'pix','Ana Paula','concluida'),
    ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a1',1,5,'fiado','ana paula ','concluida'),
    ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a2',1,5,'fiado','Jonathas','concluida'),
    ('00000000-0000-0000-0000-0000000000b4','00000000-0000-0000-0000-0000000000a2',1,5,'dinheiro',null,'concluida');
  insert into fiado_pagamentos (venda_id, valor, pagamento, data) values ('00000000-0000-0000-0000-0000000000b2',5,'pix','2026-10-30');
  update dias set status='fechado', snapshot='{"totais":{"gasto":20}}' where id='00000000-0000-0000-0000-0000000000d1';

  -- dia de hoje aberto com uma reserva
  insert into dias (id, data) values ('00000000-0000-0000-0000-0000000000d2','2026-11-03');
  insert into itens_dia (id, dia_id, produto_id, nome, produzido, preco, custo) values
    ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000f1','Empada de frango',10,6,0);
  insert into vendas (id, item_dia_id, quantidade, valor_cobrado, pagamento, cliente, status) values
    ('00000000-0000-0000-0000-0000000000b5','00000000-0000-0000-0000-0000000000a3',2,12,null,'Carla','reservada');

  -- dia lançado por resumo (só totais), sem gasto, com um produto que não existe mais
  insert into dias (id, data, status, snapshot) values ('00000000-0000-0000-0000-0000000000d3','2026-10-28','fechado',
    '{"tipo":"resumo","itens":[{"nome":"Empada de frango","produzido":13,"vendido":13,"sobra":0,"faturado":78},
                              {"nome":"Torta antiga","produzido":0,"vendido":2,"sobra":0,"faturado":14}],
      "totais":{"liquido":92,"gasto":null},"pagamentos":{"pix":92,"dinheiro":0,"cartao":0,"fiado":0}}');
`)
console.log('dados antigos criados')

// ---- a migração nova
const res = await db.exec(readFileSync(`${dir}/0004_reestruturacao.sql`, 'utf8'))
console.log('aplicada 0004; conferência:', JSON.stringify(res.at(-1).rows))

// ---- conferências
ok((await q(`select count(*)::int n from clientes`))[0].n === 3, 'clientes sem duplicar (Ana Paula, Jonathas, Carla)')
ok((await q(`select count(*)::int n from pedidos`))[0].n === 5 + 2, '5 vendas antigas + 2 pedidos do dia por resumo')
const fiadoPago = await q(`select fiado_pago_em::text, fiado_pago_com from pedidos where id='00000000-0000-0000-0000-0000000000b2'`)
ok(fiadoPago[0].fiado_pago_em === '2026-10-30' && fiadoPago[0].fiado_pago_com === 'pix', 'fiado pago copiado para o pedido')
ok((await q(`select desconto::float d from pedidos where id='00000000-0000-0000-0000-0000000000b2'`))[0].d === 1, 'desconto antigo (6 − 5) preservado')
ok((await q(`select status from pedidos where id='00000000-0000-0000-0000-0000000000b5'`))[0].status === 'reservado', 'reserva copiada')
ok((await q(`select gasto::float g, sem_gasto from dias where id='00000000-0000-0000-0000-0000000000d1'`))[0].g === 20, 'gasto do dia fechado copiado')
ok((await q(`select sem_gasto from dias where id='00000000-0000-0000-0000-0000000000d3'`))[0].sem_gasto === true, 'dia por resumo sem gasto = N/A')
const resumo = await q(`select p.pagamento, p.total::float t, p.observacao from pedidos p where dia_id='00000000-0000-0000-0000-0000000000d3' order by t`)
ok(resumo.length === 2 && resumo.every((r) => r.pagamento === 'pix') && resumo[1].t === 78, 'dia por resumo vira pedidos (todo Pix)')
ok((await q(`select ativo from produtos where nome='Torta antiga'`))[0]?.ativo === false, 'produto que não existia é cadastrado desativado')

// ---- regras novas
const erro = async (sql, msg) => { try { await db.exec(sql); ok(false, msg) } catch { ok(true, msg) } }
await erro(`insert into pedidos (dia_id,status,pagamento,total) values ('00000000-0000-0000-0000-0000000000d1','concluido','dinheiro',5)`, 'dia fechado recusa pedido novo')
await erro(`update pedidos set total=1 where id='00000000-0000-0000-0000-0000000000b1'`, 'dia fechado recusa alterar pedido')
await db.exec(`update pedidos set fiado_pago_em='2026-11-04', fiado_pago_com='dinheiro' where id='00000000-0000-0000-0000-0000000000b3'`)
ok(true, 'dia fechado aceita registrar pagamento de fiado')
await erro(`insert into pedidos (dia_id,status,pagamento,total) values ('00000000-0000-0000-0000-0000000000d2','concluido','pix',5)`, 'Pix sem cliente recusado')
await erro(`update dias set status='fechado' where id='00000000-0000-0000-0000-0000000000d2'`, 'fechar sem gasto recusado')

// salvar_pedido: carrinho com 2 produtos e cliente novo
await db.exec(`insert into itens_dia (id, dia_id, produto_id, nome, produzido, preco, custo) values
  ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000f2','Pudim',null,5,0)`)
const idp = (await q(`select salvar_pedido($1::jsonb) id`, [JSON.stringify({
  dia_id: '00000000-0000-0000-0000-0000000000d2', cliente: '  Maria  ', status: 'concluido', pagamento: 'fiado', desconto: 1,
  itens: [{ item_dia_id: '00000000-0000-0000-0000-0000000000a3', quantidade: 2, preco_unit: 6 }, { item_dia_id: '00000000-0000-0000-0000-0000000000a4', quantidade: 1, preco_unit: 5 }],
})]))[0].id
const ped = (await q(`select total::float t, (select count(*)::int from pedido_itens where pedido_id=$1) n, (select nome from clientes c where c.id=cliente_id) cli from pedidos where id=$1`, [idp]))[0]
ok(ped.t === 16 && ped.n === 2 && ped.cli === 'Maria', 'salvar_pedido: 2 produtos, desconto, cliente novo')
// editar: tira o pudim e entrega como pix, mesmo cliente com outra grafia
await q(`select salvar_pedido($1::jsonb)`, [JSON.stringify({ id: idp, dia_id: '00000000-0000-0000-0000-0000000000d2', cliente: 'maria', status: 'concluido', pagamento: 'pix', desconto: 0,
  itens: [{ item_dia_id: '00000000-0000-0000-0000-0000000000a3', quantidade: 2, preco_unit: 6 }] })])
const ped2 = (await q(`select total::float t, pagamento, (select count(*)::int from pedido_itens where pedido_id=$1) n from pedidos where id=$1`, [idp]))[0]
ok(ped2.t === 12 && ped2.pagamento === 'pix' && ped2.n === 1, 'salvar_pedido edita e troca os itens')
ok((await q(`select count(*)::int n from clientes where nome_chave='maria'`))[0].n === 1, 'cliente "maria" não duplica')
await erro(`select salvar_pedido('{"dia_id":"00000000-0000-0000-0000-0000000000d2","status":"concluido","pagamento":"dinheiro","desconto":50,"itens":[{"item_dia_id":"00000000-0000-0000-0000-0000000000a3","quantidade":1,"preco_unit":6}]}'::jsonb)`, 'desconto maior que o total recusado')

// abrir dia em outra data e fechar com N/A
const novoDia = (await q(`select abrir_dia_em('2026-10-20', $1::jsonb) id`, [JSON.stringify([{ produto_id: '00000000-0000-0000-0000-0000000000f2', produzido: '', preco: 5 }])]))[0].id
ok((await q(`select produzido from itens_dia where dia_id=$1`, [novoDia]))[0].produzido === null, 'abrir dia antigo com quantidade vazia (sem estoque)')
await erro(`select abrir_dia_em('2099-01-01', '[{"produto_id":"00000000-0000-0000-0000-0000000000f2","preco":5}]'::jsonb)`, 'dia no futuro recusado')
await db.exec(`update dias set status='fechado', sem_gasto=true where id='${novoDia}'`)
ok((await q(`select status from dias where id=$1`, [novoDia]))[0].status === 'fechado', 'fechar com "não teve gasto"')

// excluir dia: reabre e apaga tudo em cascata
await db.exec(`update dias set status='aberto' where id='00000000-0000-0000-0000-0000000000d1'`)
await db.exec(`delete from dias where id='00000000-0000-0000-0000-0000000000d1'`)
ok((await q(`select count(*)::int n from pedidos where dia_id='00000000-0000-0000-0000-0000000000d1'`))[0].n === 0, 'excluir dia apaga os pedidos dele')
ok((await q(`select count(*)::int n from vendas`))[0].n === 5, 'tabela antiga de vendas intacta (backup)')

// itens de pedido em dia fechado
const pid = (await q(`select id from pedidos where dia_id='00000000-0000-0000-0000-0000000000d3' limit 1`))[0].id
await erro(`update pedido_itens set quantidade = 99 where pedido_id='${pid}'`, 'dia fechado recusa mudar item de venda')
await db.exec(`update dias set status='aberto' where id='00000000-0000-0000-0000-0000000000d3'`)
await db.exec(`update pedido_itens set quantidade = 13 where pedido_id='${pid}'`)
ok(true, 'dia reaberto aceita mudar item de venda')

// sem login (anon) não lê nem grava nada
for (const t of ['clientes', 'pedidos', 'pedido_itens', 'dias', 'produtos']) {
  await erro(`set role anon; select * from ${t}; reset role;`, `sem login não lê ${t}`)
  await db.exec('reset role')
}
await erro(`set role anon; select salvar_pedido('{}'::jsonb);`, 'sem login não chama salvar_pedido')
await db.exec('reset role')
