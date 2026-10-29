import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Aviso, Marca } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) {
      setErro(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : navigator.onLine
            ? error.message
            : 'Sem conexão com a internet.',
      )
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <Marca tamanho={48} />
        <div>
          <h1 className="text-2xl font-extrabold">Empada &amp; Pudim</h1>
          <p className="text-sm text-sec">Controle de vendas</p>
        </div>
      </div>
      <form onSubmit={entrar} className="cartao space-y-4 p-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="rotulo">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            className="campo text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="senha" className="rotulo">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            className="campo text-base"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <button type="submit" className="btn-primario min-h-12 w-full text-lg" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
