import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adicionarItemDia, carregarDia, criarProduto, listarProdutos, mensagemErro, removerItemDia, salvarItemDia } from '../lib/api'
import { dataCurta, hojeBelem } from '../lib/datas'
import { lerReais, numeroBR, reais } from '../lib/dinheiro'
import { resumirDia } from '../lib/calculos'
import type { DiaCompleto, Produto } from '../lib/tipos'
import { useOnline } from '../hooks'
import { Aviso, Campo, Carregando, Confirmar, Icone, Pagina, Rodape, Topo } from '../components/ui'

interface Linha {
  id: string
  nome: string
  unidade: string
  vendido: number
  quantidade: string
  preco: string
  original: { quantidade: number | null; preco: number }
}

const lerQtd = (s: string) => (s.trim() === '' ? null : /^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN)

/** Mudar quantidade e preço dos produtos de um dia aberto, incluir e tirar produtos. */
export default function ProdutosDoDia() {
  const { diaId = '' } = useParams()
  const nav = useNavigate()
  const online = useOnline()
  const [d, setD] = useState<DiaCompleto | null | undefined>(undefined)
  const [catalogo, setCatalogo] = useState<Produto[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [incluir, setIncluir] = useState<{ produtoId: string; quantidade: string; preco: string } | null>(null)
  const [novo, setNovo] = useState<{ nome: string; preco: string } | null>(null)
  const [tirar, setTirar] = useState<Linha | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function carregar() {
    try {
      const [dia, ps] = await Promise.all([carregarDia(diaId), listarProdutos()])
      setD(dia)
      setCatalogo(ps.filter((p) => p.ativo))
      if (dia) {
        const r = resumirDia(dia)
        setLinhas(
          r.itens.map((i) => ({
            id: i.id,
            nome: i.nome,
            unidade: i.unidade,
            vendido: i.vendido + i.reservado,
            quantidade: i.produzido === null ? '' : String(i.produzido),
            preco: numeroBR(i.preco),
            original: { quantidade: i.produzido, preco: i.preco },
          })),
        )
      }
    } catch (e) {
      setErro(mensagemErro(e))
      setD(null)
    }
  }

  useEffect(() => {
    carregar()
  }, [diaId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (d === undefined) return <Pagina><Topo titulo="Produtos do dia" voltar={-1} /><Carregando /></Pagina>
  if (!d || d.dia.status !== 'aberto')
    return (
      <Pagina>
        <Topo titulo="Produtos do dia" voltar={-1} />
        <Aviso>{erro ?? 'Só dá para mudar os produtos de um dia aberto.'}</Aviso>
      </Pagina>
    )

  const voltar = d.dia.data === hojeBelem() ? '/' : `/dia/${d.dia.id}`
  const alterar = (i: number, campos: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...campos } : l)))
  const lidas = linhas.map((l) => ({ ...l, q: lerQtd(l.quantidade), p: lerReais(l.preco) }))
  const invalidas = lidas.filter((l) => Number.isNaN(l.q) || l.p === null)
  const mudadas = lidas.filter((l) => !Number.isNaN(l.q) && l.p !== null && (l.q !== l.original.quantidade || l.p !== l.original.preco))
  const foraDoDia = catalogo.filter((p) => !d.itens.some((i) => i.produtoId === p.id))

  async function salvar() {
    if (invalidas.length) return setErro(`Confira quantidade e preço de: ${invalidas.map((l) => l.nome).join(', ')}.`)
    setErro(null)
    setOcupado(true)
    try {
      for (const l of mudadas) await salvarItemDia(l.id, l.q, l.p!)
      nav(voltar, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setOcupado(false)
    }
  }

  async function confirmarIncluir() {
    if (!incluir) return
    const produto = catalogo.find((p) => p.id === incluir.produtoId)
    const q = lerQtd(incluir.quantidade)
    const preco = lerReais(incluir.preco)
    if (!produto || Number.isNaN(q) || preco === null) return setErro('Escolha o produto e confira quantidade e preço.')
    setOcupado(true)
    setErro(null)
    try {
      await adicionarItemDia(d!.dia.id, produto, q, preco)
      setIncluir(null)
      await carregar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setOcupado(false)
    }
  }

  async function cadastrarEIncluir() {
    if (!novo) return
    const preco = lerReais(novo.preco)
    if (!novo.nome.trim() || preco === null) return setErro('Preencha o nome e o preço do produto novo.')
    setOcupado(true)
    setErro(null)
    try {
      const p = await criarProduto({ nome: novo.nome, preco, unidade: 'un', categoria: null })
      await adicionarItemDia(d!.dia.id, p, null, preco)
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
      await carregar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setOcupado(false)
      setTirar(null)
    }
  }

  return (
    <Pagina>
      <Topo titulo="Produtos do dia" sub={dataCurta(d.dia.data)} voltar={voltar} />
      <div className="num space-y-3">
        <p className="px-1 text-sm text-sec">
          Mude a quantidade (ex.: fez mais à tarde) ou o preço. Quantidade em branco = sem controle de estoque. O preço novo vale para as próximas
          vendas; as já feitas mantêm o valor cobrado.
        </p>

        {linhas.map((l, i) => (
          <fieldset key={l.id} className="cartao p-4">
            <legend className="sr-only">{l.nome}</legend>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{l.nome}</h2>
                <p className="text-sm text-sec">
                  {l.vendido} {l.unidade} vendido(s) ou reservado(s)
                </p>
              </div>
              {l.vendido === 0 && (
                <button type="button" className="btn min-h-11 shrink-0 px-3 text-sm text-sec hover:text-alerta" onClick={() => setTirar(l)} disabled={!online}>
                  Tirar do dia
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Campo id={`q-${i}`} rotulo="Quantidade" valor={l.quantidade} onChange={(v) => alterar(i, { quantidade: v })} modo="numeric" placeholder="sem limite" />
              <Campo id={`p-${i}`} rotulo="Preço (R$)" valor={l.preco} onChange={(v) => alterar(i, { preco: v })} modo="decimal" />
            </div>
            {lerQtd(l.quantidade) !== null && !Number.isNaN(lerQtd(l.quantidade)) && (lerQtd(l.quantidade) as number) < l.vendido && (
              <p className="mt-2 text-sm text-alerta">Menor do que já foi vendido ({l.vendido}): o disponível fica negativo.</p>
            )}
          </fieldset>
        ))}

        {incluir ? (
          <div className="cartao space-y-3 border-dashed p-4">
            <div className="space-y-1.5">
              <label htmlFor="inc-prod" className="rotulo block">
                Produto
              </label>
              <select
                id="inc-prod"
                className="campo"
                value={incluir.produtoId}
                onChange={(e) => {
                  const p = catalogo.find((x) => x.id === e.target.value)
                  setIncluir({ ...incluir, produtoId: e.target.value, preco: p ? numeroBR(p.preco) : incluir.preco })
                }}
              >
                <option value="">Escolha…</option>
                {foraDoDia.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({reais(p.preco)})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Campo id="inc-q" rotulo="Quantidade" valor={incluir.quantidade} onChange={(v) => setIncluir({ ...incluir, quantidade: v })} modo="numeric" placeholder="sem limite" />
              <Campo id="inc-p" rotulo="Preço (R$)" valor={incluir.preco} onChange={(v) => setIncluir({ ...incluir, preco: v })} modo="decimal" />
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secundario flex-1" onClick={() => setIncluir(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primario flex-1" onClick={confirmarIncluir} disabled={ocupado || !online || !incluir.produtoId}>
                Incluir no dia
              </button>
            </div>
          </div>
        ) : novo ? (
          <div className="cartao space-y-3 border-dashed p-4">
            <Campo id="novo-nome" rotulo="Nome do produto novo" valor={novo.nome} onChange={(v) => setNovo({ ...novo, nome: v })} modo="text" autoFocus />
            <Campo id="novo-preco" rotulo="Preço (R$)" valor={novo.preco} onChange={(v) => setNovo({ ...novo, preco: v })} modo="decimal" />
            <div className="flex gap-2">
              <button type="button" className="btn-secundario flex-1" onClick={() => setNovo(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primario flex-1" onClick={cadastrarEIncluir} disabled={ocupado || !online}>
                Cadastrar e incluir
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn min-h-14 rounded-2xl border border-dashed border-borda text-claro hover:border-destaque disabled:opacity-40"
              onClick={() => setIncluir({ produtoId: '', quantidade: '', preco: '' })}
              disabled={!foraDoDia.length}
            >
              <Icone nome="mais" /> Incluir do cadastro
            </button>
            <button type="button" className="btn min-h-14 rounded-2xl border border-dashed border-borda text-claro hover:border-destaque" onClick={() => setNovo({ nome: '', preco: '' })}>
              <Icone nome="mais" /> Produto novo
            </button>
          </div>
        )}

        {erro && <Aviso>{erro}</Aviso>}
      </div>

      <Rodape>
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={salvar} disabled={ocupado || !online}>
          {ocupado ? 'Salvando…' : mudadas.length ? `Salvar ${mudadas.length} ${mudadas.length === 1 ? 'alteração' : 'alterações'}` : 'Voltar ao dia'}
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
        Ele ainda não teve venda neste dia. Continua no cadastro de produtos.
      </Confirmar>
    </Pagina>
  )
}
