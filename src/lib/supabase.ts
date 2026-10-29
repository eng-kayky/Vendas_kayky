import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configurado = Boolean(url && anon)

// Só a chave anon (pública) vai para o front. A segurança vem da RLS no banco.
export const supabase = createClient(url ?? 'http://localhost', anon ?? 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'empada-pudim-auth' },
})
