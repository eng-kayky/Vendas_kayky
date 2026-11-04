import { useEffect, useRef, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function Marca({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl bg-destaque font-extrabold text-fundo"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36 }}
      aria-hidden
    >
      CV
    </div>
  )
}

/** Cabeçalho das telas internas: voltar + título + subtítulo + ação opcional à direita */
export function Topo({ titulo, sub, voltar = '/', acao }: { titulo: string; sub?: string; voltar?: string | -1; acao?: ReactNode }) {
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
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-extrabold leading-tight">{titulo}</h1>
        {sub && <p className="truncate text-sm text-sec">{sub}</p>}
      </div>
      {acao}
    </header>
  )
}

/** Título das seções principais (as que aparecem na navegação) */
export function TituloSecao({ titulo, sub, acao }: { titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-4 pt-2">
      <div className="min-w-0">
        <h1 className="truncate text-3xl font-extrabold leading-tight">{titulo}</h1>
        {sub && <p className="truncate text-sm text-sec">{sub}</p>}
      </div>
      {acao}
    </header>
  )
}

export function Pagina({ children, largura = 'max-w-xl', comNav = false }: { children: ReactNode; largura?: string; comNav?: boolean }) {
  return (
    <main
      className={`mx-auto w-full ${largura} px-4 pt-[max(env(safe-area-inset-top),12px)] md:px-6 md:pt-8 ${
        comNav ? 'pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-12' : 'pb-6 md:pb-12'
      }`}
    >
      {children}
    </main>
  )
}

/**
 * Barra do botão principal. Fica no fim do conteúdo e "gruda" embaixo enquanto rola
 * (sticky): ocupa o próprio espaço, então nunca cobre nada da página.
 */
export function Rodape({ children, comNav = false }: { children: ReactNode; comNav?: boolean }) {
  return (
    <div
      className={`sticky z-20 -mx-4 mt-6 border-t border-borda/60 bg-fundo/85 px-4 pt-3 backdrop-blur-md md:mx-0 md:rounded-2xl md:border md:px-4 md:pb-3 ${
        comNav ? 'bottom-[calc(64px+env(safe-area-inset-bottom))] pb-3 md:bottom-4' : 'bottom-0 pb-[max(env(safe-area-inset-bottom),12px)] md:bottom-4'
      }`}
    >
      {children}
    </div>
  )
}

/** Bloco com título (e ação opcional à direita) */
export function Secao({ titulo, sub, acao, children, className = '' }: { titulo?: string; sub?: string; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`cartao p-4 md:p-5 ${className}`}>
      {(titulo || acao) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo && <h2 className="text-base font-bold md:text-lg">{titulo}</h2>}
            {sub && <p className="text-xs text-sec md:text-sm">{sub}</p>}
          </div>
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

/** Número de destaque com rótulo, cor opcional e linha de apoio */
export function Indicador({
  rotulo,
  valor,
  sub,
  cor = 'texto',
  grande = false,
  ponto,
}: {
  rotulo: string
  valor: string
  sub?: ReactNode
  cor?: 'texto' | 'positivo' | 'alerta' | 'claro'
  grande?: boolean
  ponto?: 'positivo' | 'alerta' | 'claro'
}) {
  const corTexto = { texto: '', positivo: 'text-positivo', alerta: 'text-alerta', claro: 'text-claro' }[cor]
  const corPonto = ponto && { positivo: 'bg-positivo', alerta: 'bg-alerta', claro: 'bg-claro' }[ponto]
  return (
    <div className="num min-w-0">
      <p className="rotulo flex items-center gap-1.5">
        {corPonto && <span className={`size-2 rounded-full ${corPonto}`} />}
        {rotulo}
      </p>
      <p className={`mt-1 truncate font-extrabold leading-tight ${grande ? 'text-4xl md:text-5xl' : 'text-[17px] sm:text-2xl'} ${corTexto}`}>{valor}</p>
      {sub && <div className="mt-1 text-xs leading-snug text-sec">{sub}</div>}
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
  const cls = tipo === 'erro' ? 'border-alerta/40 bg-[#2A1020] text-alerta' : 'border-destaque/50 bg-[#10204A] text-texto'
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      <Icone nome={tipo === 'erro' ? 'alerta' : 'info'} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Carregando() {
  return <p className="py-16 text-center text-sec">Carregando…</p>
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sec">{children}</p>
}

/** Etiqueta pequena colorida */
export function Selo({ cor = 'sec', children }: { cor?: 'sec' | 'positivo' | 'alerta' | 'claro'; children: ReactNode }) {
  const cls = {
    sec: 'bg-borda text-sec',
    positivo: 'bg-positivo/15 text-positivo',
    alerta: 'bg-alerta/15 text-alerta',
    claro: 'bg-claro/15 text-claro',
  }[cor]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>
}

/** Grupo de botões de escolha única (segmentado) */
export function Escolha<T extends string>({
  opcoes,
  valor,
  onChange,
  nome,
  colunas,
}: {
  opcoes: { valor: T; rotulo: string; cor?: 'alerta' }[]
  valor: T | null
  onChange: (v: T) => void
  nome: string
  colunas?: number
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colunas ?? opcoes.length}, minmax(0, 1fr))` }}>
      {opcoes.map((o) => (
        <label
          key={o.valor}
          className={`btn min-h-12 cursor-pointer border px-1 text-sm sm:text-base ${
            valor === o.valor
              ? o.cor === 'alerta'
                ? 'border-alerta bg-alerta text-fundo'
                : 'border-destaque bg-destaque text-fundo'
              : 'border-borda text-texto hover:border-destaque/60'
          }`}
        >
          <input type="radio" name={nome} value={o.valor} checked={valor === o.valor} onChange={() => onChange(o.valor)} className="sr-only" />
          {o.rotulo}
        </label>
      ))}
    </div>
  )
}

/** Campo de texto com rótulo */
export function Campo({
  id,
  rotulo,
  valor,
  onChange,
  modo,
  placeholder,
  dica,
  autoFocus,
  className = '',
}: {
  id: string
  rotulo: string
  valor: string
  onChange: (v: string) => void
  modo?: 'numeric' | 'decimal' | 'text' | 'tel'
  placeholder?: string
  dica?: string
  autoFocus?: boolean
  className?: string
}) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className}`}>
      <label htmlFor={id} className="rotulo block truncate">
        {rotulo}
      </label>
      <input
        id={id}
        className="campo num"
        inputMode={modo}
        value={valor}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => modo && modo !== 'text' && e.target.select()}
      />
      {dica && <p className="text-xs text-sec">{dica}</p>}
    </div>
  )
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
      className="m-auto w-[min(92vw,440px)] rounded-2xl border border-borda bg-cartao p-0 text-texto backdrop:bg-black/60"
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

// ---------------------------------------------------------------- navegação

const SECOES = [
  { para: '/', rotulo: 'Vender', icone: 'cesta', fim: true },
  { para: '/fiado', rotulo: 'Fiado', icone: 'carteira' },
  { para: '/clientes', rotulo: 'Clientes', icone: 'pessoas' },
  { para: '/historico', rotulo: 'Histórico', icone: 'calendario' },
] as const

const SECOES_DESKTOP = [...SECOES, { para: '/produtos', rotulo: 'Produtos', icone: 'caixa' }, { para: '/relatorio', rotulo: 'Relatório', icone: 'grafico' }] as const

/** Barra fixa embaixo (celular) e menu no topo (computador) */
export function Navegacao() {
  return (
    <>
      <header className="sticky top-0 z-30 hidden border-b border-borda/60 bg-fundo/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-8 py-3">
          <Link to="/" className="flex items-center gap-3">
            <Marca tamanho={40} />
            <span className="text-lg font-extrabold">Controle de Vendas</span>
          </Link>
          <nav className="flex flex-1 gap-1" aria-label="Seções">
            {SECOES_DESKTOP.map((s) => (
              <NavLink
                key={s.para}
                to={s.para}
                end={'fim' in s}
                className={({ isActive }) =>
                  `btn min-h-10 rounded-full px-4 text-sm ${isActive ? 'bg-destaque text-fundo' : 'text-sec hover:text-texto'}`
                }
              >
                {s.rotulo}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="btn-secundario min-h-10" onClick={() => supabase.auth.signOut()} title="Sair">
            <Icone nome="sair" tamanho={18} /> Sair
          </button>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-borda bg-[#081028]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Seções"
      >
        {[...SECOES, { para: '/mais', rotulo: 'Mais', icone: 'menu' } as const].map((s) => (
          <NavLink
            key={s.para}
            to={s.para}
            end={'fim' in s}
            className={({ isActive }) =>
              `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${isActive ? 'text-destaque' : 'text-sec'}`
            }
          >
            <Icone nome={s.icone} tamanho={22} />
            {s.rotulo}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

// ---------------------------------------------------------------- ícones

const caminhos = {
  voltar: <path d="M15 18l-6-6 6-6" />,
  avancar: <path d="M9 18l6-6-6-6" />,
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
  calendario: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  imagem: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  caixa: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </>
  ),
  cesta: (
    <>
      <path d="M5 8h14l-1.5 11a2 2 0 01-2 1.7h-7a2 2 0 01-2-1.7L5 8z" />
      <path d="M9 8V6a3 3 0 016 0v2" />
    </>
  ),
  carteira: (
    <>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20M16 15h2M6 6V4h12v2" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
      <path d="M16 4.5a3.5 3.5 0 010 7M18 14.6c2.2.6 3.5 2.4 3.5 5.4" />
    </>
  ),
  grafico: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  lapis: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />,
  lixo: (
    <>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" />
    </>
  ),
  pessoa: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  fechar: <path d="M18 6L6 18M6 6l12 12" />,
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
  cadeado: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type NomeIcone = keyof typeof caminhos

export function Icone({ nome, className = '', tamanho = 20 }: { nome: NomeIcone; className?: string; tamanho?: number }) {
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
