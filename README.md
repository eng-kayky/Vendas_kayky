# Empada & Pudim

App web instalável (PWA) para controlar a venda diária de empadas e pudim: produção do dia, vendas, estoque e lucro. No fim do dia, **Finalizar vendas** fecha o dia e gera uma imagem PNG de resumo.

Vite + React + TypeScript + Tailwind, Supabase (Postgres + Auth), publicado no GitHub Pages.

## 1. Supabase

1. Crie um projeto em <https://supabase.com/dashboard> (região São Paulo, `sa-east-1`).
2. **Migração:** em *SQL Editor*, cole e rode o conteúdo de `supabase/migrations/0001_init.sql`.
3. **Desligar cadastro público:** *Authentication → Sign In / Providers* → desative **Allow new users to sign up**. Mantenha o provedor *Email* ligado.
4. **Criar os 3 usuários:** *Authentication → Users → Add user → Create new user*, informe e-mail e senha e marque **Auto Confirm User**.
5. **Chaves:** em *Project Settings → API* copie a **Project URL** e a chave **anon / publishable**.
   **Nunca** use a chave `service_role` neste projeto (nem em arquivo, nem em commit, nem em variável).

`supabase/seed.dev.sql` tem produtos de exemplo só para desenvolvimento. Não rode em produção.

## 2. Rodar localmente

```bash
cp .env.example .env   # preencha URL e chave anon
npm install
npm run dev
npm test
```

## 3. GitHub Pages

1. Repositório: `eng-kayky/Vendas_kayky` (público). Se mudar o nome, troque `base` em `vite.config.ts`.
2. *Settings → Secrets and variables → Actions → Variables*: crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. *Settings → Pages → Build and deployment → Source*: **GitHub Actions**.
4. Cada push na `main` roda os testes, faz o build e publica em `https://eng-kayky.github.io/Vendas_kayky/`.
5. No Supabase, em *Authentication → URL Configuration*, coloque esse endereço como **Site URL**.

## Regras principais

- Cada dia é isolado; o estoque zera por dia. Restante = produzido − vendido (sempre calculado).
- Lucro = faturamento líquido − custo de **tudo** que foi produzido.
- Pix exige o nome do cliente (na tela e no banco).
- Dia fechado fica bloqueado no banco (triggers). Reabrir pelo Histórico descarta o resumo gravado.
- A data do dia segue o fuso de Belém (UTC−3).
- Sem login, a chave anon não lê nem escreve nada (RLS + permissões revogadas de `anon`).
- Sem conexão, o app avisa e não deixa registrar venda (não há fila offline).
