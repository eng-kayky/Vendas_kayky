import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { carregarVendaDetalhe, mensagemErro, type VendaDetalhe } from '../lib/api'
import { dataCurta, diaDaSemana, hora } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { faltaDoFiado, pagoDoFiado } from '../lib/calculos'
import { ROTULO_PAGAMENTO, type DiaCompleto, type Pedido } from '../lib/tipos'
import { SeloPagamento } from './ListaVendas'
import { Aviso, Carregando } from './ui'

/** Monta o detalhe a partir de um dia já carregado (sem ir ao servidor). */
export function detalheDoDia(p: Pedido, d: Pick<DiaCompleto, 'itens' | 'dia'>): VendaDetalhe {
  const porId = new Map(d.itens.map((i) => [i.id, i]))
  return {
    pedido: p,
    data: d.dia.data,
    linhas: p.itens.map((it) => ({
      id: it.id,
      nome: porId.get(it.itemDiaId)?.nome ?? '—',
      unidade: porId.get(it.itemDiaId)?.unidade ?? 'un',
      quantidade: it.quantidade,
      precoUnit: it.precoUnit,
      subtotal: it.subtotal,
    })),
  }
}

/**
 * Janela com tudo o que a pessoa comprou numa venda: cada produto, quantidade,
 * preço, desconto, total, forma de pagamento e, no fiado, o que já pagou.
 * Recebe a venda pronta (`venda`) ou só o id (`pedidoId`) e busca no servidor.
 */
export default function DetalheVenda({
  venda,
  pedidoId,
  diaId,
  onFechar,
}: {
  venda?: VendaDetalhe | null
  pedidoId?: string | null
  diaId?: string // mostra o atalho "Abrir o dia"
  onFechar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [buscado, setBuscado] = useState<VendaDetalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const aberto = Boolean(venda || pedidoId)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  useEffect(() => {
    setBuscado(null)
    setErro(null)
    if (venda || !pedidoId) return
    let vivo = true
    carregarVendaDetalhe(pedidoId)
      .then((v) => vivo && (v ? setBuscado(v) : setErro('Esta venda não foi encontrada (talvez tenha sido desfeita).')))
      .catch((e) => vivo && setErro(mensagemErro(e)))
    return () => {
      vivo = false
    }
  }, [Boolean(venda), pedidoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const v = venda ?? buscado
  const p = v?.pedido
  const subtotal = v ? v.linhas.reduce((s, l) => s + l.subtotal, 0) : 0
  const pago = p ? pagoDoFiado(p) : 0
  const falta = p ? faltaDoFiado(p) : 0

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onFechar()
      }}
      onClick={(e) => e.target === ref.current && onFechar()}
      className="m-auto max-h-[88dvh] w-[min(94vw,480px)] overflow-hidden rounded-2xl border border-borda bg-cartao p-0 text-texto backdrop:bg-black/60"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="border-b border-borda px-5 py-4">
          <h2 className="break-words text-lg font-bold">{p ? (p.cliente ?? 'Sem nome') : 'Venda'}</h2>
          {v && p && (
            <p className="text-sm text-sec">
              {diaDaSemana(v.data).split('-')[0]}, {dataCurta(v.data)} · {hora(p.criadoEm)}
            </p>
          )}
        </div>

        <div className="num min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {erro ? (
            <Aviso>{erro}</Aviso>
          ) : !v || !p ? (
            <Carregando />
          ) : (
            <>
              <section>
                <p className="rotulo mb-1">O que levou</p>
                <ul className="divide-y divide-borda/60">
                  {v.linhas.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="break-words font-semibold">
                          {l.quantidade}× {l.nome}
                        </p>
                        <p className="text-sm text-sec">
                          {reais(l.precoUnit)} / {l.unidade}
                        </p>
                      </div>
                      <span className="shrink-0 font-bold">{reais(l.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <dl className="space-y-1.5 border-t border-borda/60 pt-3 text-sm">
                {p.desconto !== 0 && (
                  <>
                    <Par r="Soma dos produtos" v={reais(subtotal)} />
                    <Par r={p.desconto > 0 ? 'Desconto' : 'Acréscimo'} v={`${p.desconto > 0 ? '− ' : '+ '}${reais(Math.abs(p.desconto))}`} />
                  </>
                )}
                <div className="flex items-baseline justify-between gap-3 text-base">
                  <dt className="font-semibold">Total</dt>
                  <dd className="text-xl font-extrabold">{reais(p.total)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sec">Pagamento</dt>
                  <dd>
                    <SeloPagamento p={p} pago={pago} total={p.total} />
                  </dd>
                </div>
              </dl>

              {p.pagamento === 'fiado' && p.status === 'concluido' && (
                <section className="rounded-xl border border-borda bg-elevado/60 p-3 text-sm">
                  <p className="rotulo mb-1">Fiado</p>
                  {p.recebimentos.length === 0 ? (
                    <p className="text-sec">Nenhum pagamento ainda.</p>
                  ) : (
                    <ul className="space-y-1">
                      {[...p.recebimentos]
                        .sort((a, b) => a.data.localeCompare(b.data))
                        .map((r) => (
                          <li key={r.lote} className="flex justify-between gap-3">
                            <span className="text-sec">
                              {dataCurta(r.data)} · {ROTULO_PAGAMENTO[r.forma]}
                            </span>
                            <span className="font-semibold text-positivo">{reais(r.valor)}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                  <div className="mt-2 flex justify-between gap-3 border-t border-borda/60 pt-2 font-bold">
                    <span>{falta > 0 ? 'Falta pagar' : 'Quitado'}</span>
                    <span className={falta > 0 ? 'text-alerta' : 'text-positivo'}>{falta > 0 ? reais(falta) : `pagou ${reais(pago)}`}</span>
                  </div>
                </section>
              )}

              {p.observacao && (
                <p className="break-words rounded-xl bg-elevado/60 p-3 text-sm text-sec">“{p.observacao}”</p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-borda px-5 py-3">
          {diaId && (
            <Link to={`/dia/${diaId}`} className="btn-secundario flex-1" onClick={onFechar}>
              Abrir o dia
            </Link>
          )}
          <button type="button" className="btn-primario flex-1" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  )
}

function Par({ r, v }: { r: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-sec">{r}</dt>
      <dd>{v}</dd>
    </div>
  )
}
