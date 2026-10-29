import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { mensagemErro } from './lib/api'

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function useSessao() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return sessao
}

/**
 * Carrega dados e recarrega quando a aba volta ao foco e a cada `intervalo` ms
 * (as 3 pessoas veem as vendas umas das outras sem precisar atualizar).
 */
export function useCarregar<T>(carregar: () => Promise<T>, deps: unknown[] = [], intervalo = 0) {
  const [dados, setDados] = useState<T | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(async () => {
    try {
      const d = await carregar()
      setDados(d)
      setErro(null)
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }, deps)

  useEffect(() => {
    recarregar()
    const foco = () => document.visibilityState === 'visible' && recarregar()
    document.addEventListener('visibilitychange', foco)
    window.addEventListener('online', recarregar)
    const t = intervalo ? window.setInterval(() => document.visibilityState === 'visible' && recarregar(), intervalo) : 0
    return () => {
      document.removeEventListener('visibilitychange', foco)
      window.removeEventListener('online', recarregar)
      if (t) window.clearInterval(t)
    }
  }, [recarregar, intervalo])

  return { dados, erro, carregando, recarregar }
}
