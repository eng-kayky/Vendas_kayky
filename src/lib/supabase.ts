import { createClient } from '@supabase/supabase-js'

// No build do GitHub Actions uma variável ausente chega como string vazia
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const configurado = Boolean(url && anon)

// Só a chave anon (pública) vai para o front. A segurança vem da RLS no banco.
export const supabase = createClient(url || 'http://localhost', anon || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'empada-pudim-auth' },
})
