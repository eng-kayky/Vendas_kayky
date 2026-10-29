import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { carregarHoje, clientesRecentes, mensagemErro, registrarVenda, type DiaCompleto } from '../lib/api'
import { lerReais, numeroBR, porcentagem, reais } from '../lib/dinheiro'
import { calcularResumo, descontoVenda, PAGAMENTOS, type Pagamento } from '../lib/resumo'
import { useOnline } from '../hooks'
import { Aviso, Carregando, Confirmar, Icone, Pagina, Rodape, Topo } from '../components/ui'

export default function RegistrarVenda() {
  const { itemId } = useParams()
  const nav = useNavigate()
  const online = useOnline()
  const [dia, setDia] = useState<DiaCompleto | null | undefined>(undefined)
  const [clientes, setClientes] = useState<string[]>([])
  const [qtd, setQtd] = useState(1)
  const [cobrado, setCobrado] = useState('')
  const [editado, setEditado] = useState(false) // valor cobrado foi digitado pelo usuário
  const [pagamento, setPagamento] = useState<Pagamento>('pix')
  const [cliente, setCliente] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarExcesso, setConfirmarExcesso] = useState(false)

  useEffect(() => {
    carregarHoje()
      .then(setDia)
      .catch((e) => {
        setErro(mensagemErro(e))
        setDia(null)
      })
    clientesRecentes().then(setClientes).catch(() => {})
  }, [])

  const linha = dia ? calcularResumo(dia.itens, dia.vendas).itens.find((i) => i.id === itemId) : undefined

  // Valor cobrado acompanha quantidade × preço até o usuário editar
  useEffect(() => {
    if (linha && !editado) setCobrado(numeroBR(qtd * linha.preco))
  }, [qtd, linha?.preco, editado]) // eslint-disable-line react-hooks/exhaustive-deps

  if (dia === undefined) return <Pagina><Topo titulo="Registrar venda" /><Carregando /></Pagina>
  if (!dia || !linha || dia.dia.status !== 'aberto') {
    return (
      <Pagina>
        <Topo titulo="Registrar venda" />
        <Aviso>{erro ?? 'Não há dia aberto para este produto. Volte e abra o dia.'}</Aviso>
      </Pagina>
    )
  }

  const tabela = qtd * linha.preco
  const valor = lerReais(cobrado)
  const desconto = valor === null ? 0 : descontoVenda(qtd, linha.preco, valor)
  const clienteObrigatorio = pagamento === 'pix'
  const faltaCliente = clienteObrigatorio && cliente.trim() === ''
  const excede = qtd > linha.restante
  const podeEnviar = online && valor !== null && !faltaCliente && qtd > 0 && !enviando

  async function enviar(confirmado = false) {
    if (valor === null) return setErro('Informe o valor cobrado.')
    if (faltaCliente) return setErro('No Pix, o nome do cliente (do comprovante) é obrigatório.')
    if (excede && !confirmado) return setConfirmarExcesso(true)
    setConfirmarExcesso(false)
    setErro(null)
    setEnviando(true)
    try {
      await registrarVenda({ item_dia_id: linha!.id, quantidade: qtd, valor_cobrado: valor, pagamento, cliente })
      nav('/', { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
    }
  }

  return (
    <Pagina>
      <Topo titulo="Registrar venda" />
      <form
        className="num space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
      >
        <section className="cartao flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{linha.nome}</h2>
            <p className="text-sm text-sec">Preço do dia {reais(linha.preco)}</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-extrabold ${linha.restante <= 0 ? 'text-alerta' : ''}`}>{linha.restante}</p>
            <p className="text-sm text-sec">restantes</p>
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
            {linha.restante <= 0
              ? 'Este produto já está sem estoque.'
              : `A quantidade passa do estoque (restam ${linha.restante}).`}{' '}
            Dá para vender assim mesmo, com confirmação.
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
            Valor cobrado
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
          <fieldset>
            <legend className="rotulo mb-2">Pagamento</legend>
            <div className="grid grid-cols-3 gap-2">
              {PAGAMENTOS.map((p) => (
                <label
                  key={p.valor}
                  className={`btn min-h-12 cursor-pointer border text-base ${
                    pagamento === p.valor ? 'border-destaque bg-destaque text-fundo' : 'border-borda text-texto'
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

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <label htmlFor="cliente" className="rotulo">
                Cliente
              </label>
              <span className="text-xs text-claro">Nome no comprovante · {clienteObrigatorio ? 'obrigatório no Pix' : 'opcional'}</span>
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

        {erro && <Aviso>{erro}</Aviso>}

        <Rodape>
          <button type="submit" className="btn-primario min-h-14 w-full text-lg" disabled={!podeEnviar}>
            {enviando ? 'Salvando…' : `Confirmar venda · ${valor === null ? '—' : reais(valor)}`}
          </button>
          {faltaCliente && <p className="mt-2 text-center text-xs text-sec">Informe o cliente para vender no Pix.</p>}
        </Rodape>
      </form>

      <Confirmar
        aberto={confirmarExcesso}
        titulo="Vender acima do estoque?"
        confirmar="Vender assim mesmo"
        perigo
        ocupado={enviando}
        onConfirmar={() => enviar(true)}
        onCancelar={() => setConfirmarExcesso(false)}
      >
        Restam {linha.restante} de {linha.nome} e a venda é de {qtd}. O restante vai ficar negativo ({linha.restante - qtd}).
      </Confirmar>
    </Pagina>
  )
}
