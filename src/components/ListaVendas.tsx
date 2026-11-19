import { useState } from 'react'
import { Link } from 'react-router-dom'
import { excluirPedido, mensagemErro } from '../lib/api'
import { hora } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { pagoDoFiado } from '../lib/calculos'
import { ROTULO_PAGAMENTO, type DiaCompleto, type Pedido } from '../lib/tipos'
import { useOnline } from '../hooks'
import { Aviso, Confirmar, Icone, Selo } from './ui'
import DetalheVenda, { detalheDoDia } from './DetalheVenda'

/** Etiqueta da forma de pagamento; no fiado mostra se já foi pago. */
export function SeloPagamento({
  p,
  pago = 0,
  total = 0,
}: {
  p: Pick<Pedido, 'pagamento' | 'fiadoPagoEm' | 'fiadoPagoCom' | 'status'>
  pago?: number // fiado: quanto já foi pago (parcial)
  total?: number
}) {
  if (p.status === 'reservado') return <Selo cor="claro">Reservado</Selo>
  if (p.pagamento === 'fiado') {
    if (p.fiadoPagoEm) return <Selo cor="positivo">Fiado pago · {ROTULO_PAGAMENTO[p.fiadoPagoCom!]}</Selo>
    if (pago > 0) return <Selo cor="alerta">Fiado · pagou {reais(pago)}{total ? ` de ${reais(total)}` : ''}</Selo>
    return <Selo cor="alerta">Fiado · a receber</Selo>
  }
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
  const [ver, setVer] = useState<Pedido | null>(null)
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
            <button type="button" onClick={() => setVer(p)} className="min-w-0 flex-1 rounded-xl text-left hover:bg-borda/20" title="Ver o que comprou">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold">{p.cliente ?? 'Sem nome'}</span>
                <span className="shrink-0 font-bold">{reais(p.total)}</span>
              </div>
              <p className="truncate text-sm text-sec">
                {hora(p.criadoEm)} · {descreverPedido(p, d)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <SeloPagamento p={p} pago={pagoDoFiado(p)} total={p.total} />
                {p.desconto !== 0 && (
                  <span className={`text-xs ${p.desconto > 0 ? 'text-alerta' : 'text-positivo'}`}>
                    {p.desconto > 0 ? `desconto ${reais(p.desconto)}` : `acréscimo ${reais(-p.desconto)}`}
                  </span>
                )}
                {p.observacao && <span className="truncate text-xs text-sec">“{p.observacao}”</span>}
              </div>
            </button>
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

      <DetalheVenda venda={ver ? detalheDoDia(ver, d) : null} onFechar={() => setVer(null)} onSalvo={onMudou} />

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
            {pagoDoFiado(alvo) > 0 && ` Os pagamentos do fiado (${reais(pagoDoFiado(alvo))}) também são apagados.`}
          </>
        )}
      </Confirmar>
    </>
  )
}
