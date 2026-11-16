import { useEffect, useState } from 'react'
import { mensagemErro, receberFiado } from '../lib/api'
import { dataCurta } from '../lib/datas'
import { lerReais, numeroBR, reais } from '../lib/dinheiro'
import { FORMAS_RECEBIMENTO, type FormaRecebimento } from '../lib/tipos'
import { Aviso, Confirmar, Escolha } from './ui'

export interface AlvoRecebimento {
  clienteId: string
  cliente: string
  falta: number
  /** Vendas em aberto, da mais antiga para a mais nova (é a ordem em que o valor abate). */
  vendas: { pedidoId: string; data: string; itens: string; falta: number }[]
  /** true = abate só destas vendas (e não das outras do cliente) */
  soEstas?: boolean
}

/** Receber um valor do cliente: total ou parcial ("por conta"), abatendo da compra mais antiga. */
export default function ReceberFiado({ alvo, onFechar, onRecebido }: { alvo: AlvoRecebimento | null; onFechar: () => void; onRecebido: () => void }) {
  const [valorTexto, setValorTexto] = useState('')
  const [forma, setForma] = useState<FormaRecebimento>('pix')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!alvo) return
    setValorTexto(numeroBR(alvo.falta))
    setForma('pix')
    setErro(null)
  }, [alvo])

  const valor = lerReais(valorTexto)
  const invalido = valor === null || valor <= 0
  const demais = valor !== null && alvo !== null && valor > alvo.falta
  const parcial = valor !== null && alvo !== null && valor > 0 && valor < alvo.falta

  // Prévia: como o valor abate as vendas, da mais antiga para a mais nova
  let resto = valor ?? 0
  const previa = (alvo?.vendas ?? []).map((v) => {
    const parte = Math.max(0, Math.min(v.falta, resto))
    resto -= parte
    return { ...v, parte }
  })

  async function confirmar() {
    if (!alvo || invalido || demais) return
    setOcupado(true)
    setErro(null)
    try {
      await receberFiado(alvo.clienteId, valor!, forma, alvo.soEstas ? alvo.vendas.map((v) => v.pedidoId) : undefined)
      onRecebido()
      onFechar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setOcupado(false)
    }
  }

  const atalhos = alvo ? [...new Set([5000, 2000, 1000, 500].filter((v) => v < alvo.falta))].slice(0, 3) : []

  return (
    <Confirmar
      aberto={alvo !== null}
      titulo={alvo ? `Receber de ${alvo.cliente}` : ''}
      confirmar={valor && !invalido && !demais ? `Receber ${reais(valor)}` : 'Receber'}
      ocupado={ocupado}
      onConfirmar={confirmar}
      onCancelar={onFechar}
    >
      {alvo && (
        <div className="num space-y-3 text-texto">
          <p className="text-sec">
            Deve <strong className="text-alerta">{reais(alvo.falta)}</strong>
            {alvo.soEstas ? ' nesta venda' : ''}. Pode receber tudo ou só uma parte.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="valor-receber" className="rotulo block">
              Valor recebido
            </label>
            <div className="flex min-h-14 items-center gap-2 rounded-xl border border-destaque bg-fundo/70 px-4 focus-within:ring-2 focus-within:ring-destaque/30">
              <span className="text-lg text-sec">R$</span>
              <input
                id="valor-receber"
                className="w-full bg-transparent text-2xl font-extrabold outline-none"
                inputMode="decimal"
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                onFocus={(e) => e.target.select()}
                aria-invalid={invalido || demais}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-9 rounded-full border border-borda px-3 text-sm text-sec hover:text-texto" onClick={() => setValorTexto(numeroBR(alvo.falta))}>
                Tudo ({reais(alvo.falta)})
              </button>
              {atalhos.map((v) => (
                <button key={v} type="button" className="min-h-9 rounded-full border border-borda px-3 text-sm text-sec hover:text-texto" onClick={() => setValorTexto(numeroBR(v))}>
                  {reais(v)}
                </button>
              ))}
            </div>
            {invalido && valorTexto.trim() !== '' && <p className="text-sm text-alerta">Informe um valor maior que zero.</p>}
            {demais && <p className="text-sm text-alerta">O valor passa do que falta ({reais(alvo.falta)}).</p>}
          </div>

          <div>
            <p className="rotulo mb-2">Pagou com</p>
            <Escolha nome="forma-receber" opcoes={FORMAS_RECEBIMENTO} valor={forma} onChange={setForma} />
          </div>

          {!invalido && !demais && (
            <div className="rounded-xl border border-borda bg-fundo/50 p-3 text-sm">
              <p className="mb-1.5 font-semibold">{parcial ? `Pagamento parcial: continua devendo ${reais(alvo.falta - valor!)}` : 'Quita tudo'}</p>
              <ul className="space-y-1">
                {previa.map((v) => (
                  <li key={v.pedidoId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-sec">
                      {dataCurta(v.data)} · {v.itens}
                    </span>
                    <span className={`shrink-0 ${v.parte === 0 ? 'text-sec' : v.parte >= v.falta ? 'text-positivo' : 'text-texto'}`}>
                      {v.parte === 0 ? 'continua' : v.parte >= v.falta ? `quita ${reais(v.parte)}` : `abate ${reais(v.parte)} de ${reais(v.falta)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-sec">O valor abate da compra mais antiga para a mais nova. Aparece no resumo do dia de cada venda.</p>
            </div>
          )}
          {erro && <Aviso>{erro}</Aviso>}
        </div>
      )}
    </Confirmar>
  )
}
