import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  atualizarVenda,
  carregarDiaDoItem,
  carregarVenda,
  horaParaDia,
  telaDoDia,
  clientesRecentes,
  desfazerVenda,
  mensagemErro,
  registrarReserva,
  registrarVenda,
  type DiaCompleto,
  type Venda,
} from '../lib/api'
import { dataCurta, hojeBelem } from '../lib/datas'
import { lerReais, numeroBR, porcentagem, reais } from '../lib/dinheiro'
import { calcularResumo, descontoVenda, exigeCliente, PAGAMENTOS, type Pagamento } from '../lib/resumo'
import { useOnline } from '../hooks'
import { Aviso, Carregando, Confirmar, Icone, Pagina, Rodape, Topo } from '../components/ui'

/**
 * Uma tela, quatro usos:
 *  /vender/:itemId  → vender ou reservar
 *  /venda/:vendaId  → corrigir uma venda, ou entregar/cancelar uma reserva
 */
type Modo = 'vender' | 'reservar' | 'editar' | 'entregar'

export default function RegistrarVenda() {
  const { itemId, vendaId } = useParams()
  const nav = useNavigate()
  const online = useOnline()
  const [dia, setDia] = useState<DiaCompleto | null | undefined>(undefined)
  const [venda, setVenda] = useState<Venda | null>(null)
  const [modo, setModo] = useState<Modo>(vendaId ? 'editar' : 'vender')
  const [clientes, setClientes] = useState<string[]>([])
  const [qtd, setQtd] = useState(1)
  const [cobrado, setCobrado] = useState('')
  const [editado, setEditado] = useState(false) // valor cobrado foi digitado pelo usuário
  const [pagamento, setPagamento] = useState<Pagamento | null>('pix')
  const [cliente, setCliente] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarExcesso, setConfirmarExcesso] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        // Funciona em qualquer dia aberto (hoje ou um dia anterior reaberto pelo Histórico)
        let d: DiaCompleto | null = null
        if (vendaId) {
          const v = await carregarVenda(vendaId)
          if (!v) throw new Error('Venda não encontrada.')
          d = await carregarDiaDoItem(v.item_dia_id)
          if (d?.dia.status !== 'aberto') throw new Error('Esse dia está fechado. Reabra pelo Histórico para alterar.')
          setVenda(v)
          setQtd(v.quantidade)
          setCobrado(numeroBR(v.valor_cobrado))
          setEditado(true)
          setCliente(v.cliente ?? '')
          if (v.status === 'reservada') {
            setModo('entregar')
            setPagamento(null)
          } else setPagamento(v.pagamento)
        } else if (itemId) {
          d = await carregarDiaDoItem(itemId)
        }
        setDia(d)
      } catch (e) {
        setErro(mensagemErro(e))
        setDia(null)
      }
    })()
    clientesRecentes().then(setClientes).catch(() => {})
  }, [vendaId, itemId])

  const idItem = venda?.item_dia_id ?? itemId
  const linha = dia ? calcularResumo(dia.itens, dia.vendas).itens.find((i) => i.id === idItem) : undefined

  // Valor cobrado acompanha quantidade × preço até o usuário editar
  useEffect(() => {
    if (linha && !editado) setCobrado(numeroBR(qtd * linha.preco))
  }, [qtd, linha?.preco, editado]) // eslint-disable-line react-hooks/exhaustive-deps

  const tituloModo = { vender: 'Registrar venda', reservar: 'Reservar', editar: 'Editar venda', entregar: 'Entregar reserva' }[modo]

  if (dia === undefined) return <Pagina><Topo titulo={tituloModo} /><Carregando /></Pagina>
  if (!dia || !linha || dia.dia.status !== 'aberto') {
    return (
      <Pagina>
        <Topo titulo={tituloModo} />
        <Aviso>{erro ?? 'Não há dia aberto para este produto. Volte e abra o dia.'}</Aviso>
      </Pagina>
    )
  }

  const voltar = telaDoDia(dia.dia)
  const reservando = modo === 'reservar'
  // Ao editar, as unidades desta própria venda/reserva voltam para o disponível
  const disponivel = linha.restante + (venda ? venda.quantidade : 0)
  const tabela = qtd * linha.preco
  const valor = lerReais(cobrado)
  const desconto = valor === null ? 0 : descontoVenda(qtd, linha.preco, valor)
  const clienteObrigatorio = reservando || (pagamento !== null && exigeCliente(pagamento))
  const faltaCliente = clienteObrigatorio && cliente.trim() === ''
  const faltaPagamento = !reservando && pagamento === null
  const excede = qtd > disponivel
  const podeEnviar = online && valor !== null && !faltaCliente && !faltaPagamento && qtd > 0 && !enviando

  async function enviar(confirmado = false) {
    if (valor === null) return setErro('Informe o valor.')
    if (faltaPagamento) return setErro('Escolha a forma de pagamento.')
    if (faltaCliente) return setErro(reservando ? 'Informe o nome de quem reservou.' : 'No Pix e no fiado, o nome do cliente é obrigatório.')
    if (excede && !confirmado) return setConfirmarExcesso(true)
    setConfirmarExcesso(false)
    setErro(null)
    setEnviando(true)
    try {
      const base = { quantidade: qtd, valor_cobrado: valor, cliente }
      const criado_em = horaParaDia(dia!.dia.data)
      if (modo === 'vender') await registrarVenda({ ...base, item_dia_id: linha!.id, pagamento: pagamento!, criado_em })
      else if (modo === 'reservar') await registrarReserva({ ...base, item_dia_id: linha!.id, criado_em })
      else await atualizarVenda(venda!.id, { ...base, pagamento: pagamento!, status: modo === 'entregar' ? 'concluida' : undefined })
      nav(voltar, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
    }
  }

  async function cancelarReserva() {
    setEnviando(true)
    try {
      await desfazerVenda(venda!.id)
      nav(voltar, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
      setConfirmarCancelar(false)
    }
  }

  const rotuloBotao = enviando
    ? 'Salvando…'
    : `${{ vender: 'Confirmar venda', reservar: 'Reservar', editar: 'Salvar alterações', entregar: 'Entregar' }[modo]} · ${
        valor === null ? '—' : reais(valor)
      }`

  return (
    <Pagina>
      <Topo titulo={tituloModo} sub={dia.dia.data !== hojeBelem() ? `Dia ${dataCurta(dia.dia.data)}` : undefined} voltar={voltar} />
      <form
        className="num space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
      >
        {!vendaId && (
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
        {reservando && (
          <p className="px-1 text-sm text-sec">
            As unidades ficam separadas para o cliente. Quando ele buscar, toque na reserva em "Hoje" e escolha o pagamento.
          </p>
        )}
        {modo === 'entregar' && (
          <p className="px-1 text-sm text-sec">Reserva de {venda?.cliente}. Escolha como pagou para virar venda.</p>
        )}

        <section className="cartao flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{linha.nome}</h2>
            <p className="text-sm text-sec">Preço do dia {reais(linha.preco)}</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-extrabold ${disponivel <= 0 ? 'text-alerta' : ''}`}>{disponivel}</p>
            <p className="text-sm text-sec">disponíveis</p>
          </div>
        </section>

        <section className="cartao flex items-center justify-between gap-3 p-4">
          <label htmlFor="qtd" className="rotulo">
            Quantidade
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="grid size-14 place-items-center rounded-xl border border-borda bg-fundo/40 disabled:opacity-40"
              onClick={() => setQtd((q) => Math.max(1, q - 1))}
              disabled={qtd <= 1}
              aria-label="Diminuir quantidade"
            >
              <Icone nome="menos" />
            </button>
            <input
              id="qtd"
              className="w-14 bg-transparent text-center text-4xl font-extrabold outline-none"
              inputMode="numeric"
              value={qtd}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''))
                setQtd(n > 0 ? Math.min(n, 9999) : 1)
              }}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="grid size-14 place-items-center rounded-xl bg-destaque text-fundo"
              onClick={() => setQtd((q) => q + 1)}
              aria-label="Aumentar quantidade"
            >
              <Icone nome="mais" />
            </button>
          </div>
        </section>
        {excede && (
          <Aviso>
            {disponivel <= 0 ? 'Este produto já está sem estoque.' : `A quantidade passa do disponível (${disponivel}).`} Dá para seguir
            assim mesmo, com confirmação.
          </Aviso>
        )}

        <section className="cartao space-y-2 p-4">
          <div className="flex justify-between text-sec">
            <span>
              Valor de tabela ({qtd} × {reais(linha.preco)})
            </span>
            <span className="font-bold text-texto">{reais(tabela)}</span>
          </div>
          <label htmlFor="cobrado" className="rotulo block pt-1">
            {reservando ? 'Valor combinado' : 'Valor cobrado'}
          </label>
          <div className="flex min-h-16 items-center gap-2 rounded-xl border border-destaque bg-fundo/60 px-4 focus-within:ring-2 focus-within:ring-destaque/30">
            <span className="text-xl text-sec">R$</span>
            <input
              id="cobrado"
              className="w-full bg-transparent text-3xl font-extrabold outline-none"
              inputMode="decimal"
              value={cobrado}
              onChange={(e) => {
                setEditado(true)
                setCobrado(e.target.value)
              }}
              onFocus={(e) => e.target.select()}
              aria-invalid={valor === null}
            />
          </div>
          {valor === null ? (
            <p className="text-sm text-alerta">Valor inválido.</p>
          ) : desconto !== 0 ? (
            <div
              className={`flex justify-between rounded-xl border px-4 py-2 text-sm font-semibold ${
                desconto > 0 ? 'border-alerta/40 bg-[#2A1020] text-alerta' : 'border-positivo/40 bg-positivo/10 text-positivo'
              }`}
            >
              <span>{desconto > 0 ? 'Desconto aplicado' : 'Acréscimo'}</span>
              <span>
                {desconto > 0 ? reais(-desconto) : `+${reais(-desconto)}`} ({porcentagem(Math.abs(desconto) / tabela)})
              </span>
            </div>
          ) : null}
          {editado && valor !== tabela && (
            <button
              type="button"
              className="text-sm font-semibold text-claro underline"
              onClick={() => {
                setEditado(false)
                setCobrado(numeroBR(tabela))
              }}
            >
              Voltar para o valor de tabela
            </button>
          )}
        </section>

        <section className="cartao space-y-3 p-4">
          {!reservando && (
            <fieldset>
              <legend className="rotulo mb-2">Pagamento</legend>
              <div className="grid grid-cols-4 gap-2">
                {PAGAMENTOS.map((p) => (
                  <label
                    key={p.valor}
                    className={`btn min-h-12 cursor-pointer border px-1 text-sm sm:text-base ${
                      pagamento === p.valor
                        ? p.valor === 'fiado'
                          ? 'border-alerta bg-alerta text-fundo'
                          : 'border-destaque bg-destaque text-fundo'
                        : 'border-borda text-texto'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pagamento"
                      value={p.valor}
                      checked={pagamento === p.valor}
                      onChange={() => setPagamento(p.valor)}
                      className="sr-only"
                    />
                    {p.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <label htmlFor="cliente" className="rotulo">
                Cliente
              </label>
              <span className="text-xs text-claro">
                {reservando
                  ? 'Quem vai buscar · obrigatório'
                  : pagamento === 'fiado'
                    ? 'Quem vai pagar depois · obrigatório'
                    : `Nome no comprovante · ${clienteObrigatorio ? 'obrigatório no Pix' : 'opcional'}`}
              </span>
            </div>
            <div
              className={`flex min-h-12 items-center gap-2 rounded-xl border bg-fundo/60 px-3 focus-within:ring-2 focus-within:ring-destaque/30 ${
                faltaCliente && erro ? 'border-alerta' : 'border-borda focus-within:border-destaque'
              }`}
            >
              <Icone nome="pessoa" className="shrink-0 text-sec" />
              <input
                id="cliente"
                className="w-full bg-transparent text-lg font-semibold outline-none"
                value={cliente}
                autoComplete="off"
                autoCapitalize="words"
                onChange={(e) => setCliente(e.target.value)}
                required={clienteObrigatorio}
              />
            </div>
            {clientes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {clientes.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCliente(c)}
                    className={`min-h-11 rounded-full border px-4 text-sm ${
                      cliente === c ? 'border-destaque bg-destaque/15 text-texto' : 'border-borda text-sec hover:text-texto'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
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
          {(faltaCliente || faltaPagamento) && (
            <p className="mt-2 text-center text-xs text-sec">
              {faltaPagamento ? 'Escolha como o cliente pagou.' : reservando ? 'Informe quem vai buscar.' : 'Informe o cliente.'}
            </p>
          )}
        </Rodape>
      </form>

      <Confirmar
        aberto={confirmarExcesso}
        titulo="Passar do disponível?"
        confirmar="Seguir assim mesmo"
        perigo
        ocupado={enviando}
        onConfirmar={() => enviar(true)}
        onCancelar={() => setConfirmarExcesso(false)}
      >
        Restam {disponivel} de {linha.nome} e são {qtd}. O restante vai ficar negativo ({disponivel - qtd}).
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
        As {venda?.quantidade} unidades voltam para o disponível.
      </Confirmar>
    </Pagina>
  )
}
