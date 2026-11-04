import { useState } from 'react'
import { Link } from 'react-router-dom'
import { excluirPedido, mensagemErro } from '../lib/api'
import { hora } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { ROTULO_PAGAMENTO, type DiaCompleto, type Pedido } from '../lib/tipos'
import { useOnline } from '../hooks'
import { Aviso, Confirmar, Icone, Selo } from './ui'

/** Etiqueta da forma de pagamento; no fiado mostra se já foi pago. */
export function SeloPagamento({ p }: { p: Pick<Pedido, 'pagamento' | 'fiadoPagoEm' | 'fiadoPagoCom' | 'status'> }) {
  if (p.status === 'reservado') return <Selo cor="claro">Reservado</Selo>
  if (p.pagamento === 'fiado')
    return p.fiadoPagoEm ? <Selo cor="positivo">Fiado pago · {ROTULO_PAGAMENTO[p.fiadoPagoCom!]}</Selo> : <Selo cor="alerta">Fiado · a receber</Selo>
  return <Selo>{p.pagamento ? ROTULO_PAGAMENTO[p.pagamento] : '—'}</Selo>
}

/** "2× Empada de frango, 1 fatia Pudim" */
export function descreverPedido(p: Pedido, d: Pick<DiaCompleto, 'itens'>) {
  const porId = new Map(d.itens.map((i) => [i.id, i]))
  return p.itens
    .map((it) => {
      const item = porId.get(it.itemDiaId)
      return `${it.quantidade}× ${item?.nome ?? '—'}`
    })
    .join(', ')
}

/** Lista das vendas do dia, mais nova primeiro, com editar e desfazer (dia aberto). */
export default function ListaVendas({ d, aberto, onMudou }: { d: DiaCompleto; aberto: boolean; onMudou: () => void }) {
  const online = useOnline()
  const [alvo, setAlvo] = useState<Pedido | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const vendas = d.pedidos.filter((p) => p.status === 'concluido')

  async function desfazer() {
    if (!alvo) return
    setOcupado(true)
    setErro(null)
    try {
      await excluirPedido(alvo.id)
      onMudou()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setOcupado(false)
      setAlvo(null)
    }
  }

  if (!vendas.length) return <p className="py-6 text-center text-sec">Nenhuma venda registrada ainda.</p>

  return (
    <>
      {erro && (
        <div className="mb-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      <ul className="divide-y divide-borda/60">
        {vendas.map((p) => (
          <li key={p.id} className="num flex items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold">{p.cliente ?? 'Sem nome'}</span>
                <span className="shrink-0 font-bold">{reais(p.total)}</span>
              </div>
              <p className="truncate text-sm text-sec">
                {hora(p.criadoEm)} · {descreverPedido(p, d)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <SeloPagamento p={p} />
                {p.desconto !== 0 && (
                  <span className={`text-xs ${p.desconto > 0 ? 'text-alerta' : 'text-positivo'}`}>
                    {p.desconto > 0 ? `desconto ${reais(p.desconto)}` : `acréscimo ${reais(-p.desconto)}`}
                  </span>
                )}
                {p.observacao && <span className="truncate text-xs text-sec">“{p.observacao}”</span>}
              </div>
            </div>
            {aberto && (
              <div className="flex shrink-0">
                <Link
                  to={`/venda/${p.id}`}
                  className={`grid size-11 place-items-center rounded-xl text-sec hover:bg-destaque/10 hover:text-claro ${online ? '' : 'pointer-events-none opacity-40'}`}
                  aria-label="Editar venda"
                  title="Editar venda"
                >
                  <Icone nome="lapis" tamanho={18} />
                </Link>
                <button
                  type="button"
                  onClick={() => setAlvo(p)}
                  disabled={!online}
                  className="grid size-11 place-items-center rounded-xl text-sec hover:bg-alerta/10 hover:text-alerta disabled:opacity-40"
                  aria-label="Desfazer venda"
                  title="Desfazer venda"
                >
                  <Icone nome="desfazer" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Confirmar
        aberto={alvo !== null}
        titulo="Desfazer esta venda?"
        confirmar="Desfazer venda"
        perigo
        ocupado={ocupado}
        onConfirmar={desfazer}
        onCancelar={() => setAlvo(null)}
      >
        {alvo && (
          <>
            {descreverPedido(alvo, d)} · {reais(alvo.total)}
            {alvo.cliente ? ` (${alvo.cliente})` : ''}, às {hora(alvo.criadoEm)}. As unidades voltam para o estoque.
            {alvo.fiadoPagoEm && ' O pagamento do fiado também é apagado.'}
          </>
        )}
      </Confirmar>
    </>
  )
}
