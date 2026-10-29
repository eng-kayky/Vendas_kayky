import { createClient } from '@supabase/supabase-js'

// Projeto de produção. A URL e a chave publishable são públicas (vão para o navegador de qualquer jeito);
// quem protege os dados é a RLS no banco. Variáveis VITE_* sobrescrevem, se existirem.
// NUNCA coloque aqui a chave secreta (sb_secret_ / service_role).
const URL_PADRAO = 'https://iejjtbiygbtysgsjutdc.supabase.co'
const CHAVE_PUBLICA_PADRAO = 'sb_publishable_fye7nfyL0cKJx9AftgGE6A_U0wwbrmo'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || URL_PADRAO
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || CHAVE_PUBLICA_PADRAO

export const configurado = Boolean(url && anon)

// Só a chave anon (pública) vai para o front. A segurança vem da RLS no banco.
export const supabase = createClient(url || 'http://localhost', anon || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'empada-pudim-auth' },
})
