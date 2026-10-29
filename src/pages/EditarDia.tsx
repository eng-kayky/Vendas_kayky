import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  adicionarItemDia,
  carregarDiaPorId,
  listarProdutos,
  mensagemErro,
  removerItemDia,
  salvarItemDia,
  type DiaCompleto,
  type Produto,
} from '../lib/api'
import { dataLonga } from '../lib/datas'
import { lerReais, numeroBR, reais } from '../lib/dinheiro'
import { calcularResumo } from '../lib/resumo'
import { useOnline } from '../hooks'
import { Aviso, Carregando, Confirmar, Pagina, Rodape, Topo } from '../components/ui'

interface Linha {
  id: string
  nome: string
  vendido: number
  produzido: string
  preco: string
  original: { produzido: number; preco: number }
}

const inteiro = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null)

export default function EditarDia() {
  const { diaId = '' } = useParams()
  const nav = useNavigate()
  const online = useOnline()
  const [dia, setDia] = useState<DiaCompleto | null | undefined>(undefined)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [novo, setNovo] = useState<{ produtoId: string; produzido: string; preco: string } | null>(null)
  const [tirar, setTirar] = useState<Linha | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function carregar() {
    try {
      const [d, ps] = await Promise.all([carregarDiaPorId(diaId), listarProdutos()])
      setDia(d)
      setProdutos(ps.filter((p) => p.ativo))
      if (d) {
        const r = calcularResumo(d.itens, d.vendas)
        setLinhas(
          r.itens.map((i) => ({
            id: i.id,
            nome: i.nome,
            vendido: i.vendido,
            produzido: String(i.produzido),
            preco: numeroBR(i.preco),
            original: { produzido: i.produzido, preco: i.preco },
          })),
        )
      }
    } catch (e) {
      setErro(mensagemErro(e))
      setDia(null)
    }
  }

  useEffect(() => {
    carregar()
  }, [diaId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (dia === undefined) return <Pagina><Topo titulo="Produtos do dia" /><Carregando /></Pagina>
  if (!dia || dia.dia.status !== 'aberto')
    return (
      <Pagina>
        <Topo titulo="Produtos do dia" />
        <Aviso>{erro ?? 'Só dá para editar um dia aberto.'}</Aviso>
      </Pagina>
    )

  const alterar = (i: number, campo: 'produzido' | 'preco', v: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)))

  const lidas = linhas.map((l) => ({ ...l, n: inteiro(l.produzido), p: lerReais(l.preco) }))
  const mudadas = lidas.filter((l) => l.n !== l.original.produzido || l.p !== l.original.preco)
  const invalidas = lidas.filter((l) => l.n === null || l.p === null)
  const disponiveis = produtos.filter((p) => !dia.itens.some((i) => i.produto_id === p.id))

  async function salvar() {
    if (invalidas.length) return setErro(`Confira quantidade e preço de: ${invalidas.map((l) => l.nome).join(', ')}.`)
    setErro(null)
    setOcupado(true)
    try {
      for (const l of mudadas) await salvarItemDia(l.id, l.n!, l.p!)
      nav('/', { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setOcupado(false)
    }
  }

  async function incluir() {
    if (!novo) return
    const produto = produtos.find((p) => p.id === novo.produtoId)
    const n = inteiro(novo.produzido)
    const preco = lerReais(novo.preco)
    if (!produto || !n || preco === null) return setErro('Escolha o produto e informe quantidade e preço.')
    setErro(null)
    setOcupado(true)
    try {
      await adicionarItemDia(diaId, produto, n, preco)
      setNovo(null)
      await carregar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarTirar() {
    if (!tirar) return
    setOcupado(true)
    try {
      await removerItemDia(tirar.id)
      setTirar(null)
      await carregar()
    } catch (e) {
      setErro(mensagemErro(e))
      setTirar(null)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Pagina>
      <Topo titulo="Produtos do dia" sub={dataLonga(dia.dia.data)} />
      <div className="num space-y-3">
        <p className="text-sm text-sec">
          Corrija a quantidade (ex.: fez mais à tarde) ou o preço. O preço do dia também é usado para calcular o desconto das vendas já feitas.
        </p>

        {linhas.map((l, i) => (
          <fieldset key={l.id} className="cartao p-4">
            <legend className="sr-only">{l.nome}</legend>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold" aria-hidden>
                  {l.nome}
                </h2>
                <p className="text-sm text-sec">{l.vendido} vendidas até agora</p>
              </div>
              {l.vendido === 0 && (
                <button
                  type="button"
                  className="min-h-11 shrink-0 rounded-xl px-3 text-sm text-sec hover:bg-alerta/10 hover:text-alerta"
                  onClick={() => setTirar(l)}
                  disabled={!online}
                >
                  Tirar do dia
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Campo id={`n-${i}`} rotulo="Quantidade" valor={l.produzido} onChange={(v) => alterar(i, 'produzido', v)} modo="numeric" />
              <Campo id={`p-${i}`} rotulo="Preço (R$)" valor={l.preco} onChange={(v) => alterar(i, 'preco', v)} />
            </div>
            {inteiro(l.produzido) !== null && inteiro(l.produzido)! < l.vendido && (
              <p className="mt-2 text-sm text-alerta">Menor do que já foi vendido ({l.vendido}): o restante fica negativo.</p>
            )}
          </fieldset>
        ))}

        {novo ? (
          <div className="cartao space-y-3 border-dashed p-4">
            <div className="space-y-1.5">
              <label htmlFor="nv-prod" className="rotulo block">
                Produto
              </label>
              <select
                id="nv-prod"
                className="campo"
                value={novo.produtoId}
                onChange={(e) => {
                  const p = produtos.find((x) => x.id === e.target.value)
                  setNovo({ ...novo, produtoId: e.target.value, preco: p ? numeroBR(p.preco) : novo.preco })
                }}
              >
                <option value="">Escolha…</option>
                {disponiveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({reais(p.preco)})
                  </option>
                ))}
              </select>
              {disponiveis.length === 0 && <p className="text-sm text-sec">Todos os produtos já estão no dia. Cadastre um novo na tela Produtos.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Campo id="nv-n" rotulo="Quantidade" valor={novo.produzido} onChange={(v) => setNovo({ ...novo, produzido: v })} modo="numeric" />
              <Campo id="nv-p" rotulo="Preço (R$)" valor={novo.preco} onChange={(v) => setNovo({ ...novo, preco: v })} />
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secundario flex-1" onClick={() => setNovo(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primario flex-1" onClick={incluir} disabled={ocupado || !online}>
                Incluir no dia
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn min-h-14 w-full rounded-2xl border border-dashed border-borda text-claro hover:border-destaque"
            onClick={() => setNovo({ produtoId: '', produzido: '', preco: '' })}
          >
            + Incluir produto no dia
          </button>
        )}

        {erro && <Aviso>{erro}</Aviso>}
      </div>

      <Rodape>
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={salvar} disabled={ocupado || !online}>
          {ocupado ? 'Salvando…' : mudadas.length ? `Salvar ${mudadas.length} ${mudadas.length === 1 ? 'alteração' : 'alterações'}` : 'Voltar'}
        </button>
      </Rodape>

      <Confirmar
        aberto={tirar !== null}
        titulo={`Tirar "${tirar?.nome}" do dia?`}
        confirmar="Tirar do dia"
        perigo
        ocupado={ocupado}
        onConfirmar={confirmarTirar}
        onCancelar={() => setTirar(null)}
      >
        Ele ainda não teve venda hoje. Continua cadastrado em Produtos.
      </Confirmar>
    </Pagina>
  )
}

function Campo({
  id,
  rotulo,
  valor,
  onChange,
  modo = 'decimal',
}: {
  id: string
  rotulo: string
  valor: string
  onChange: (v: string) => void
  modo?: 'numeric' | 'decimal'
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="rotulo block truncate">
        {rotulo}
      </label>
      <input
        id={id}
        className="campo num"
        inputMode={modo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
}
