import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { carregarDia, carregarPedido, excluirPedido, horaParaDia, mensagemErro, nomesDeClientes, salvarPedido } from '../lib/api'
import { dataCurta, hojeBelem } from '../lib/datas'
import { lerReais, numeroBR, porcentagem, reais } from '../lib/dinheiro'
import { disponivelNoCarrinho, resumirDia, subtotalCarrinho, type LinhaCarrinho } from '../lib/calculos'
import { exigeCliente, FORMAS_VENDA, type DiaCompleto, type Pagamento, type Pedido } from '../lib/tipos'
import { useOnline } from '../hooks'
import { Aviso, Carregando, Confirmar, Escolha, Icone, Pagina, Rodape, Topo } from '../components/ui'

type Modo = 'vender' | 'reservar' | 'editar' | 'entregar'

/**
 * Venda com carrinho (vários produtos), desconto, pagamento e cliente.
 *  /dia/:diaId/venda[?produto=id]  → nova venda ou reserva
 *  /venda/:pedidoId                → corrigir uma venda, ou entregar/cancelar uma reserva
 */
/** `exemplo`: só para a prévia de desenvolvimento (dados fixos, sem banco). */
export default function Venda({ exemplo }: { exemplo?: { d: DiaCompleto; produto?: string } } = {}) {
  const { diaId: diaParam, pedidoId } = useParams()
  const [busca] = useSearchParams()
  const nav = useNavigate()
  const online = useOnline()

  const [d, setD] = useState<DiaCompleto | null | undefined>(undefined)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [modo, setModo] = useState<Modo>(pedidoId ? 'editar' : 'vender')
  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([])
  const [cobradoTexto, setCobradoTexto] = useState<string | null>(null) // null = cobra o subtotal
  const [pagamento, setPagamento] = useState<Pagamento | null>(null)
  const [cliente, setCliente] = useState('')
  const [observacao, setObservacao] = useState('')
  const [nomes, setNomes] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarExcesso, setConfirmarExcesso] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        let dia: DiaCompleto | null = null
        if (exemplo) {
          dia = exemplo.d
          if (exemplo.produto) setCarrinho([{ itemDiaId: exemplo.produto, quantidade: 1, precoUnit: dia.itens.find((i) => i.id === exemplo.produto)!.preco }])
        } else if (pedidoId) {
          const p = await carregarPedido(pedidoId)
          if (!p) throw new Error('Venda não encontrada.')
          dia = await carregarDia(p.diaId)
          setPedido(p)
          setCarrinho(p.itens.map((i) => ({ itemDiaId: i.itemDiaId, quantidade: i.quantidade, precoUnit: i.precoUnit })))
          setCobradoTexto(p.desconto !== 0 ? numeroBR(p.total) : null)
          setCliente(p.cliente ?? '')
          setObservacao(p.observacao ?? '')
          if (p.status === 'reservado') {
            setModo('entregar')
            setPagamento(null)
          } else setPagamento(p.pagamento)
        } else if (diaParam) {
          dia = await carregarDia(diaParam)
          const inicial = busca.get('produto')
          const item = dia?.itens.find((i) => i.id === inicial)
          if (item) setCarrinho([{ itemDiaId: item.id, quantidade: 1, precoUnit: item.preco }])
        }
        if (dia && dia.dia.status !== 'aberto') throw new Error('Esse dia está fechado. Reabra-o para vender ou corrigir.')
        setD(dia)
      } catch (e) {
        setErro(mensagemErro(e))
        setD(null)
      }
    })()
    if (exemplo) setNomes(['Ana Paula', 'Jorge', 'Prof Mayara'])
    else nomesDeClientes().then(setNomes).catch(() => {})
  }, [pedidoId, diaParam]) // eslint-disable-line react-hooks/exhaustive-deps

  const r = useMemo(() => (d ? resumirDia(d) : null), [d])
  // Ao editar, as unidades da própria venda voltam para o disponível
  const devolver = (itemId: string) => pedido?.itens.filter((i) => i.itemDiaId === itemId).reduce((s, i) => s + i.quantidade, 0) ?? 0

  const titulo = { vender: 'Nova venda', reservar: 'Nova reserva', editar: 'Editar venda', entregar: 'Entregar reserva' }[modo]
  if (d === undefined) return <Pagina><Topo titulo={titulo} voltar={-1} /><Carregando /></Pagina>
  if (!d || !r)
    return (
      <Pagina>
        <Topo titulo={titulo} voltar={-1} />
        <Aviso>{erro ?? 'Dia não encontrado.'}</Aviso>
      </Pagina>
    )

  const voltar = d.dia.data === hojeBelem() ? '/' : `/dia/${d.dia.id}`
  const reservando = modo === 'reservar'
  const subtotal = subtotalCarrinho(carrinho)
  const cobrado = cobradoTexto === null ? subtotal : lerReais(cobradoTexto)
  const desconto = cobrado === null ? 0 : subtotal - cobrado
  const status = reservando ? 'reservado' : 'concluido' // entregar uma reserva = virar venda concluída
  const precisaCliente = exigeCliente(reservando ? 'reservado' : 'concluido', reservando ? null : pagamento)
  const faltaCliente = precisaCliente && !cliente.trim()
  const faltaPagamento = !reservando && pagamento === null
  const excedidos = r.itens.filter((l) => {
    const disp = disponivelNoCarrinho(l, carrinho, devolver(l.id))
    return disp !== null && disp < 0
  })
  const podeEnviar = online && !enviando && carrinho.length > 0 && cobrado !== null && cobrado >= 0 && !faltaCliente && !faltaPagamento

  function mudarQuantidade(itemId: string, delta: number) {
    const item = d!.itens.find((i) => i.id === itemId)!
    setCarrinho((c) => {
      const atual = c.find((l) => l.itemDiaId === itemId)
      if (!atual) return delta > 0 ? [...c, { itemDiaId: itemId, quantidade: delta, precoUnit: item.preco }] : c
      const q = atual.quantidade + delta
      return q <= 0 ? c.filter((l) => l.itemDiaId !== itemId) : c.map((l) => (l.itemDiaId === itemId ? { ...l, quantidade: q } : l))
    })
  }

  async function enviar(confirmado = false) {
    if (!carrinho.length) return setErro('Escolha ao menos um produto.')
    if (cobrado === null || cobrado < 0) return setErro('Valor cobrado inválido.')
    if (faltaPagamento) return setErro('Escolha a forma de pagamento.')
    if (faltaCliente) return setErro(reservando ? 'Informe quem vai buscar.' : 'No Pix e no fiado, o nome do cliente é obrigatório.')
    if (excedidos.length && !confirmado) return setConfirmarExcesso(true)
    setConfirmarExcesso(false)
    setErro(null)
    setEnviando(true)
    try {
      await salvarPedido({
        id: pedido?.id,
        diaId: d!.dia.id,
        cliente,
        status,
        pagamento: status === 'reservado' ? null : pagamento,
        desconto,
        observacao,
        criadoEm: pedido ? undefined : horaParaDia(d!.dia.data),
        itens: carrinho,
      })
      nav(voltar, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
    }
  }

  async function cancelarReserva() {
    setEnviando(true)
    try {
      await excluirPedido(pedido!.id)
      nav(voltar, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
      setConfirmarCancelar(false)
    }
  }

  const sugestoes = nomes
    .filter((n) => !cliente.trim() || n.toLocaleLowerCase('pt-BR').includes(cliente.trim().toLocaleLowerCase('pt-BR')))
    .filter((n) => n !== cliente)
    .slice(0, 8)
  const rotuloBotao = enviando
    ? 'Salvando…'
    : `${{ vender: 'Confirmar venda', reservar: 'Reservar', editar: 'Salvar alterações', entregar: 'Entregar' }[modo]} · ${cobrado === null ? '—' : reais(cobrado)}`

  return (
    <Pagina largura="max-w-6xl">
      <Topo titulo={titulo} sub={d.dia.data !== hojeBelem() ? `Dia ${dataCurta(d.dia.data)}` : undefined} voltar={voltar} />
      <form
        className="num grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
      >
        {/* esquerda: produtos */}
        <div className="min-w-0 space-y-4">
        {!pedidoId && (
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-borda bg-cartao p-1" role="tablist" aria-label="Tipo">
            {(['vender', 'reservar'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={modo === m}
                className={`btn min-h-11 ${modo === m ? 'bg-destaque text-fundo' : 'text-sec'}`}
                onClick={() => setModo(m)}
              >
                {m === 'vender' ? 'Vender' : 'Reservar'}
              </button>
            ))}
          </div>
        )}
        {reservando && <p className="px-1 text-sm text-sec">As unidades ficam separadas. Quando o cliente buscar, toque em Entregar na tela do dia.</p>}
        {modo === 'entregar' && <p className="px-1 text-sm text-sec">Reserva de {pedido?.cliente}. Confira os produtos e escolha como pagou.</p>}

        {/* produtos */}
        <section>
          <h2 className="rotulo mb-2 px-1">Produtos</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {r.itens.map((l) => {
              const q = carrinho.find((c) => c.itemDiaId === l.id)?.quantidade ?? 0
              const disp = disponivelNoCarrinho(l, carrinho, devolver(l.id))
              return (
                <div key={l.id} className={`cartao p-3 ${q ? 'border-destaque bg-destaque/10' : ''}`}>
                  <button type="button" className="block w-full text-left" onClick={() => mudarQuantidade(l.id, 1)}>
                    <p className="font-bold leading-tight">{l.nome}</p>
                    <p className="mt-0.5 text-sm text-sec">
                      {reais(l.preco)} / {l.unidade}
                    </p>
                    <p className={`mt-0.5 text-xs ${disp !== null && disp <= 0 ? 'text-alerta' : 'text-sec'}`}>
                      {disp === null ? 'sem limite' : disp <= 0 ? (disp < 0 ? `${-disp} acima do estoque` : 'esgotado') : `${disp} disponíveis`}
                    </p>
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="grid size-11 place-items-center rounded-xl border border-borda disabled:opacity-30"
                      onClick={() => mudarQuantidade(l.id, -1)}
                      disabled={!q}
                      aria-label={`Menos ${l.nome}`}
                    >
                      <Icone nome="menos" />
                    </button>
                    <span className={`text-2xl font-extrabold ${q ? '' : 'text-sec'}`} aria-live="polite">
                      {q}
                    </span>
                    <button
                      type="button"
                      className="grid size-11 place-items-center rounded-xl bg-destaque text-fundo"
                      onClick={() => mudarQuantidade(l.id, 1)}
                      aria-label={`Mais ${l.nome}`}
                    >
                      <Icone nome="mais" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        </div>

        {/* direita: carrinho, pagamento e cliente (acompanha a rolagem no computador) */}
        <div className="space-y-4 lg:sticky lg:top-6">
        {/* total */}
        <section className="painel space-y-3 p-4">
          <h2 className="rotulo">Carrinho</h2>
          {carrinho.length === 0 ? (
            <p className="text-center text-sec">Toque nos produtos para montar a venda.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {carrinho.map((c) => {
                const item = d.itens.find((i) => i.id === c.itemDiaId)!
                return (
                  <li key={c.itemDiaId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {c.quantidade}× {item.nome} <span className="text-sec">({reais(c.precoUnit)})</span>
                    </span>
                    <span className="shrink-0 font-semibold">{reais(c.quantidade * c.precoUnit)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex items-baseline justify-between border-t border-borda pt-3">
            <span className="text-sec">Subtotal</span>
            <span className="text-lg font-bold">{reais(subtotal)}</span>
          </div>

          {cobradoTexto === null ? (
            <button type="button" className="text-sm font-semibold text-claro underline" onClick={() => setCobradoTexto(numeroBR(subtotal))} disabled={!carrinho.length}>
              Dar desconto ou cobrar outro valor
            </button>
          ) : (
            <div className="space-y-2">
              <label htmlFor="cobrado" className="rotulo block">
                Valor cobrado
              </label>
              <div className="flex min-h-14 items-center gap-2 rounded-xl border border-destaque bg-fundo/60 px-4 focus-within:ring-2 focus-within:ring-destaque/30">
                <span className="text-lg text-sec">R$</span>
                <input
                  id="cobrado"
                  className="w-full bg-transparent text-2xl font-extrabold outline-none"
                  inputMode="decimal"
                  value={cobradoTexto}
                  onChange={(e) => setCobradoTexto(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  aria-invalid={cobrado === null}
                />
              </div>
              {cobrado === null ? (
                <p className="text-sm text-alerta">Valor inválido.</p>
              ) : desconto !== 0 ? (
                <p className={`text-sm font-semibold ${desconto > 0 ? 'text-alerta' : 'text-positivo'}`}>
                  {desconto > 0 ? `Desconto de ${reais(desconto)}` : `Acréscimo de ${reais(-desconto)}`} ({porcentagem(subtotal ? Math.abs(desconto) / subtotal : 0)})
                </p>
              ) : null}
              <button type="button" className="text-sm font-semibold text-claro underline" onClick={() => setCobradoTexto(null)}>
                Voltar para o valor normal
              </button>
            </div>
          )}
        </section>

        {/* pagamento e cliente */}
        <section className="cartao space-y-4 p-4">
          {!reservando && (
            <fieldset>
              <legend className="rotulo mb-2">Pagamento</legend>
              <Escolha
                nome="pagamento"
                opcoes={FORMAS_VENDA.map((f) => ({ valor: f.valor, rotulo: f.rotulo, cor: f.valor === 'fiado' ? ('alerta' as const) : undefined }))}
                valor={pagamento}
                onChange={setPagamento}
              />
            </fieldset>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <label htmlFor="cliente" className="rotulo">
                Cliente
              </label>
              <span className="text-xs text-claro">
                {reservando ? 'quem vai buscar · obrigatório' : pagamento === 'fiado' ? 'quem vai pagar depois · obrigatório' : pagamento === 'pix' ? 'nome no comprovante · obrigatório' : 'opcional'}
              </span>
            </div>
            <div className={`flex min-h-12 items-center gap-2 rounded-xl border bg-fundo/60 px-3 ${faltaCliente && erro ? 'border-alerta' : 'border-borda focus-within:border-destaque'}`}>
              <Icone nome="pessoa" className="shrink-0 text-sec" />
              <input
                id="cliente"
                className="w-full bg-transparent text-lg font-semibold outline-none"
                value={cliente}
                autoComplete="off"
                autoCapitalize="words"
                placeholder="Nome"
                onChange={(e) => setCliente(e.target.value)}
              />
              {cliente && (
                <button type="button" className="grid size-9 place-items-center text-sec" onClick={() => setCliente('')} aria-label="Limpar cliente">
                  <Icone nome="fechar" tamanho={16} />
                </button>
              )}
            </div>
            {sugestoes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sugestoes.map((n) => (
                  <button key={n} type="button" onClick={() => setCliente(n)} className="min-h-10 rounded-full border border-borda px-3 text-sm text-sec hover:text-texto">
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="obs" className="rotulo block">
              Observação (opcional)
            </label>
            <input id="obs" className="campo text-base" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: sem cebola, entregar às 18h" />
          </div>
        </section>

        {modo === 'entregar' && (
          <button type="button" className="btn-perigo min-h-12 w-full" onClick={() => setConfirmarCancelar(true)} disabled={!online || enviando}>
            Cancelar reserva
          </button>
        )}
        {erro && <Aviso>{erro}</Aviso>}

        <Rodape>
          <button type="submit" className="btn-primario min-h-14 w-full text-lg" disabled={!podeEnviar}>
            {rotuloBotao}
          </button>
          {(faltaCliente || faltaPagamento || !carrinho.length) && (
            <p className="mt-2 text-center text-xs text-sec">
              {!carrinho.length ? 'Escolha os produtos.' : faltaPagamento ? 'Escolha como o cliente pagou.' : 'Informe o nome do cliente.'}
            </p>
          )}
        </Rodape>
        </div>
      </form>

      <Confirmar
        aberto={confirmarExcesso}
        titulo="Passar do estoque?"
        confirmar="Seguir assim mesmo"
        perigo
        ocupado={enviando}
        onConfirmar={() => enviar(true)}
        onCancelar={() => setConfirmarExcesso(false)}
      >
        {excedidos.map((l) => l.nome).join(', ')}: a quantidade passa do que foi informado no dia. O disponível vai ficar negativo.
      </Confirmar>

      <Confirmar
        aberto={confirmarCancelar}
        titulo="Cancelar esta reserva?"
        confirmar="Cancelar reserva"
        perigo
        ocupado={enviando}
        onConfirmar={cancelarReserva}
        onCancelar={() => setConfirmarCancelar(false)}
      >
        Os produtos voltam para o disponível.
      </Confirmar>
    </Pagina>
  )
}
