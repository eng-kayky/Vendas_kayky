import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { carregarVendaDetalhe, editarVenda, mensagemErro, type VendaDetalhe } from '../lib/api'
import { dataCurta, diaDaSemana, hora } from '../lib/datas'
import { lerReais, numeroBR, reais } from '../lib/dinheiro'
import { faltaDoFiado, pagoDoFiado } from '../lib/calculos'
import { ROTULO_PAGAMENTO, type DiaCompleto, type Pedido } from '../lib/tipos'
import { SeloPagamento } from './ListaVendas'
import { useOnline } from '../hooks'
import { Aviso, Carregando, Icone } from './ui'

/** Monta o detalhe a partir de um dia já carregado (sem ir ao servidor). */
export function detalheDoDia(p: Pedido, d: Pick<DiaCompleto, 'itens' | 'dia'>): VendaDetalhe {
  const porId = new Map(d.itens.map((i) => [i.id, i]))
  return {
    pedido: p,
    data: d.dia.data,
    linhas: p.itens.map((it) => ({
      id: it.id,
      itemDiaId: it.itemDiaId,
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
  onSalvo,
}: {
  venda?: VendaDetalhe | null
  pedidoId?: string | null
  diaId?: string // mostra o atalho "Abrir o dia"
  onFechar: () => void
  onSalvo?: () => void // com isto aparece "Editar valores"; chamado depois de salvar
}) {
  const online = useOnline()
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroEd, setErroEd] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
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
    setEdicao(null)
    setErroEd(null)
  }, [aberto, pedidoId, venda?.pedido.id])

  useEffect(() => {
    setBuscado((b) => (b && b.pedido.id === pedidoId ? b : null)) // ao recarregar a mesma venda, mantém na tela
    setErro(null)
    if (venda || !pedidoId) return
    let vivo = true
    carregarVendaDetalhe(pedidoId)
      .then((v) => vivo && (v ? setBuscado(v) : setErro('Esta venda não foi encontrada (talvez tenha sido desfeita).')))
      .catch((e) => vivo && setErro(mensagemErro(e)))
    return () => {
      vivo = false
    }
  }, [Boolean(venda), pedidoId, versao]) // eslint-disable-line react-hooks/exhaustive-deps

  const v = venda ?? buscado
  const p = v?.pedido
  const subtotal = v ? v.linhas.reduce((s, l) => s + l.subtotal, 0) : 0
  const pago = p ? pagoDoFiado(p) : 0
  const falta = p ? faltaDoFiado(p) : 0

  function comecarEdicao() {
    if (!v || !p) return
    setErroEd(null)
    setEdicao({
      desconto: p.desconto,
      linhas: v.linhas.map((l) => ({ chave: l.id, itemDiaId: l.itemDiaId, nome: l.nome, unidade: l.unidade, quantidade: l.quantidade, preco: numeroBR(l.precoUnit) })),
    })
  }

  async function salvar() {
    if (!edicao || !p) return
    const itens = edicao.linhas.map((l) => ({ itemDiaId: l.itemDiaId, quantidade: l.quantidade, precoUnit: lerReais(l.preco) }))
    if (itens.some((i) => i.precoUnit === null)) return setErroEd('Confira os preços: algum valor está inválido.')
    const soma = itens.reduce((s, i) => s + i.quantidade * (i.precoUnit ?? 0), 0)
    if (soma - edicao.desconto < 0) return setErroEd('O total não pode ficar negativo.')
    if (soma - edicao.desconto < pago) return setErroEd(`${p.cliente ?? 'O cliente'} já pagou ${reais(pago)} desta venda; o total não pode ficar menor que isso.`)
    setSalvando(true)
    setErroEd(null)
    try {
      await editarVenda(p.id, itens as { itemDiaId: string; quantidade: number; precoUnit: number }[], edicao.desconto)
      setEdicao(null)
      setVersao((n) => n + 1)
      onSalvo?.()
    } catch (e) {
      setErroEd(mensagemErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onFechar()
      }}
      onClick={(e) => e.target === ref.current && onFechar()}
      className="m-auto max-h-[88dvh] w-[min(94vw,480px)] touch-manipulation overflow-hidden rounded-2xl border border-borda bg-cartao p-0 text-texto backdrop:bg-black/60"
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
          ) : edicao ? (
            <Editor edicao={edicao} onMudar={setEdicao} pago={pago} erro={erroEd} />
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

              {onSalvo && (
                <button type="button" className="btn-secundario min-h-12 w-full" onClick={comecarEdicao} disabled={!online}>
                  <Icone nome="lapis" tamanho={18} /> Editar valores
                </button>
              )}

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

        {edicao ? (
          <div className="flex gap-2 border-t border-borda px-5 py-3">
            <button type="button" className="btn-secundario flex-1" onClick={() => setEdicao(null)} disabled={salvando}>
              Cancelar
            </button>
            <button type="button" className="btn-primario flex-1" onClick={salvar} disabled={salvando || !online}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        ) : (
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
        )}
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

interface Edicao {
  desconto: number // centavos; negativo = acréscimo
  linhas: { chave: string; itemDiaId: string; nome: string; unidade: string; quantidade: number; preco: string }[]
}

/** Corrigir quantidades, preços e o total. Mexer no total vira desconto (ou acréscimo). */
function Editor({ edicao, onMudar, pago, erro }: { edicao: Edicao; onMudar: (e: Edicao) => void; pago: number; erro: string | null }) {
  const soma = edicao.linhas.reduce((s, l) => s + l.quantidade * (lerReais(l.preco) ?? 0), 0)
  const total = soma - edicao.desconto
  const [totalTexto, setTotalTexto] = useState(numeroBR(total))
  const [editandoTotal, setEditandoTotal] = useState(false)
  const mostrarTotal = editandoTotal ? totalTexto : numeroBR(total)

  const mudarLinha = (i: number, parte: Partial<Edicao['linhas'][number]>) =>
    onMudar({ ...edicao, linhas: edicao.linhas.map((l, k) => (k === i ? { ...l, ...parte } : l)) })

  return (
    <div className="space-y-4">
      <section>
        <p className="rotulo mb-1">Produtos</p>
        <ul className="divide-y divide-borda/60">
          {edicao.linhas.map((l, i) => {
            const preco = lerReais(l.preco)
            return (
              <li key={l.chave} className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold">{l.nome}</p>
                  {edicao.linhas.length > 1 && (
                    <button
                      type="button"
                      className="-my-1 shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-sec hover:bg-alerta/10 hover:text-alerta"
                      onClick={() => onMudar({ ...edicao, linhas: edicao.linhas.filter((_, k) => k !== i) })}
                    >
                      Tirar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex shrink-0 items-center rounded-xl border border-borda">
                    <button
                      type="button"
                      className="grid size-9 place-items-center text-lg text-sec disabled:opacity-30"
                      onClick={() => mudarLinha(i, { quantidade: l.quantidade - 1 })}
                      disabled={l.quantidade <= 1}
                      aria-label="Menos um"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold">{l.quantidade}</span>
                    <button
                      type="button"
                      className="grid size-9 place-items-center text-lg text-sec"
                      onClick={() => mudarLinha(i, { quantidade: l.quantidade + 1 })}
                      aria-label="Mais um"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sec">×</span>
                  <label className="flex min-w-0 items-center gap-1">
                    <span className="text-sm text-sec">R$</span>
                    <input
                      className={`campo h-10 w-[4.25rem] px-1.5 text-right ${preco === null ? 'border-alerta' : ''}`}
                      inputMode="decimal"
                      value={l.preco}
                      onChange={(e) => mudarLinha(i, { preco: e.target.value })}
                      aria-label={`Preço de ${l.nome}`}
                    />
                  </label>
                  <span className="ml-auto shrink-0 pl-1 font-bold">{preco === null ? '—' : reais(l.quantidade * preco)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-2 border-t border-borda/60 pt-3">
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Total da venda</span>
          <span className="flex items-center gap-1">
            <span className="text-sec">R$</span>
            <input
              className="campo h-12 w-28 px-2 text-right text-xl font-extrabold"
              inputMode="decimal"
              value={mostrarTotal}
              onFocus={() => {
                setTotalTexto(numeroBR(total))
                setEditandoTotal(true)
              }}
              onBlur={() => setEditandoTotal(false)}
              onChange={(e) => {
                setTotalTexto(e.target.value)
                const t = lerReais(e.target.value)
                if (t !== null) onMudar({ ...edicao, desconto: soma - t })
              }}
              aria-label="Total da venda"
            />
          </span>
        </label>
        <p className="text-sm text-sec">
          Soma dos produtos {reais(soma)}
          {edicao.desconto !== 0 && (
            <>
              {' · '}
              <span className={edicao.desconto > 0 ? 'text-alerta' : 'text-positivo'}>
                {edicao.desconto > 0 ? `desconto ${reais(edicao.desconto)}` : `acréscimo ${reais(-edicao.desconto)}`}
              </span>{' '}
              <button type="button" className="font-semibold text-destaque underline" onClick={() => onMudar({ ...edicao, desconto: 0 })}>
                tirar
              </button>
            </>
          )}
        </p>
        {pago > 0 && <p className="text-sm text-sec">Já pagou {reais(pago)}: o total não pode ficar abaixo disso.</p>}
        <p className="text-xs text-sec">Ao salvar, o dia desta venda é atualizado sozinho, mesmo se estiver fechado.</p>
      </section>

      {erro && <Aviso>{erro}</Aviso>}
    </div>
  )
}
