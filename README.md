# Controle de Vendas

App web instalável (PWA) para vender produtos por dia: você abre o dia com os produtos (preço e, se quiser, quantidade), registra as vendas num carrinho, controla fiado e reservas, e no fim fecha o dia informando o gasto com material. Resumo, imagens para compartilhar, histórico, clientes e relatório são calculados na hora a partir das vendas.

Site: <https://eng-kayky.github.io/Vendas_kayky/>

## Como funciona

- **Produtos**: cadastro com nome, preço, unidade (un, fatia, pote…) e categoria.
- **Abrir o dia**: hoje ou qualquer data anterior. Para cada produto, preço e quantidade (vazio = sem controle de estoque).
- **Vender**: carrinho com vários produtos, desconto (ou acréscimo), Pix / Dinheiro / Cartão / Fiado, cliente com sugestão de nomes, observação. Reservar separa os produtos até o cliente buscar.
- **Fiado**: conta no faturamento do dia da venda; quando o cliente paga, o pagamento aparece no resumo daquele dia.
- **Fechar o dia**: informa o gasto com material ou "não teve gasto"; o dia fica bloqueado (dá para reabrir).
- **Clientes**: ficha com compras, quanto deve, receber tudo e lembrete pelo WhatsApp.
- **Relatório**: semana e mês, com imagem.

## Banco (Supabase)

Rode no SQL Editor, na ordem, os arquivos de `supabase/migrations/`. Cada um roda uma vez só.
A `0004_reestruturacao.sql` cria a estrutura atual (clientes, pedidos com itens) e copia os dados das versões antigas, mantendo as tabelas antigas como backup.

Usuários: *Authentication → Users → Add user* (marque *Auto Confirm User*) e deixe *Allow new users to sign up* desligado.

## Desenvolvimento

```bash
npm install
npm run dev          # prévia com dados de exemplo em #/dev/imagem, #/dev/imagem?painel, ?fechado e ?venda
npm test             # cálculos
npm run test:banco   # migrações num Postgres local (PGlite)
```

Cada push na `main` roda os testes, faz o build e publica no GitHub Pages.
