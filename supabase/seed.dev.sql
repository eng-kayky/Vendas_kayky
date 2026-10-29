-- Dados de EXEMPLO só para desenvolvimento. Não rode em produção.
-- Não entra no build nem no deploy.
insert into public.produtos (nome, preco_padrao, custo_padrao) values
  ('Empada de frango', 6.00, 2.50),
  ('Empada de palmito', 6.00, 2.50),
  ('Pudim', 8.00, 3.50)
on conflict (nome) do nothing;
