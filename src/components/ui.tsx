import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export function Marca({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl bg-destaque font-extrabold text-fundo"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36 }}
      aria-hidden
    >
      E&amp;P
    </div>
  )
}

/** Cabeçalho das telas internas: voltar + título + subtítulo */
export function Topo({ titulo, sub, voltar = '/' }: { titulo: string; sub?: string; voltar?: string | -1 }) {
  const nav = useNavigate()
  return (
    <header className="flex items-center gap-3 pb-4 pt-2">
      <button
        type="button"
        onClick={() => (voltar === -1 ? nav(-1) : nav(voltar))}
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-borda bg-cartao text-texto hover:border-destaque/60"
        aria-label="Voltar"
      >
        <Icone nome="voltar" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold leading-tight">{titulo}</h1>
        {sub && <p className="truncate text-sm text-sec">{sub}</p>}
      </div>
    </header>
  )
}

export function Pagina({ children, largura = 'max-w-lg' }: { children: ReactNode; largura?: string }) {
  return <main className={`mx-auto w-full ${largura} px-4 pb-32 pt-[max(env(safe-area-inset-top),12px)]`}>{children}</main>
}

/** Barra fixa no rodapé para o botão principal */
export function Rodape({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda/60 bg-fundo/90 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  )
}

export function Barra({ valor, total, baixo }: { valor: number; total: number; baixo?: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (valor / total) * 100)) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-borda" role="progressbar" aria-valuenow={valor} aria-valuemax={total}>
      <div className={`h-full rounded-full ${baixo ? 'bg-alerta' : 'bg-destaque'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'info'; children: ReactNode }) {
  const cls =
    tipo === 'erro' ? 'border-alerta/40 bg-[#2A1020] text-alerta' : 'border-destaque/50 bg-[#10204A] text-texto'
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      <Icone nome={tipo === 'erro' ? 'alerta' : 'info'} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function Carregando() {
  return <p className="py-16 text-center text-sec">Carregando…</p>
}

/** Diálogo de confirmação acessível (usa <dialog>) */
export function Confirmar({
  aberto,
  titulo,
  children,
  confirmar,
  perigo,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean
  titulo: string
  children?: ReactNode
  confirmar: string
  perigo?: boolean
  ocupado?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onCancelar()
      }}
      className="m-auto w-[min(92vw,420px)] rounded-2xl border border-borda bg-cartao p-0 text-texto backdrop:bg-black/60"
    >
      <div className="space-y-3 p-5">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {children && <div className="text-sm text-sec">{children}</div>}
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-secundario flex-1" onClick={onCancelar} disabled={ocupado}>
            Cancelar
          </button>
          <button type="button" className={`${perigo ? 'btn-perigo' : 'btn-primario'} flex-1`} onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? 'Aguarde…' : confirmar}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export function Abas() {
  const atual = useLocation().pathname.startsWith('/historico') ? 'historico' : 'hoje'
  const cls = (ativo: boolean) =>
    `btn min-h-11 rounded-full px-5 ${ativo ? 'bg-destaque text-fundo' : 'border border-borda text-texto hover:border-destaque/60'}`
  return (
    <nav className="flex gap-2" aria-label="Seções">
      <Link to="/" className={cls(atual === 'hoje')}>
        Hoje
      </Link>
      <Link to="/historico" className={cls(atual === 'historico')}>
        Histórico
      </Link>
    </nav>
  )
}

const caminhos: Record<string, ReactNode> = {
  voltar: <path d="M15 18l-6-6 6-6" />,
  alerta: (
    <>
      <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  imagem: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  pessoa: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  compartilhar: (
    <>
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
      <path d="M16 6l-4-4-4 4M12 2v13" />
    </>
  ),
  baixar: (
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </>
  ),
  sair: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  desfazer: (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 00-15-6.7L3 13" />
    </>
  ),
}

export function Icone({ nome, className = '', tamanho = 20 }: { nome: keyof typeof caminhos; className?: string; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {caminhos[nome]}
    </svg>
  )
}
