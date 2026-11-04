import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { abrirDia, carregarDiaPorData, criarProduto, listarProdutos, mensagemErro } from '../lib/api'
import { dataLonga, hojeBelem } from '../lib/datas'
import { lerReais, numeroBR, reais } from '../lib/dinheiro'
import { UNIDADES, type Produto } from '../lib/tipos'
import { useOnline } from '../hooks'
import { Aviso, Campo, Carregando, Icone, Pagina, Rodape, Topo } from '../components/ui'

interface Linha {
  produto: Produto
  marcado: boolean
  quantidade: string // vazio = sem controle de estoque
  preco: string
}

const lerQtd = (s: string) => (s.trim() === '' ? null : /^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN)

/** Abrir um dia de vendas (hoje ou outra data) escolhendo os produtos, preço e quantidade. */
export default function AbrirDia() {
  const nav = useNavigate()
  const online = useOnline()
  const [busca] = useSearchParams()
  const hoje = hojeBelem()
  const [data, setData] = useState(busca.get('data') ?? hoje)
  const [outraData, setOutraData] = useState(Boolean(busca.get('outra') || busca.get('data')))
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [novo, setNovo] = useState<{ nome: string; preco: string; unidade: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [diaExistente, setDiaExistente] = useState<string | null>(null)

  useEffect(() => {
    listarProdutos()
      .then((ps) => {
        const ativos = ps.filter((p) => p.ativo)
        setLinhas(ativos.map((p) => ({ produto: p, marcado: true, quantidade: '', preco: p.preco ? numeroBR(p.preco) : '' })))
        if (!ativos.length) setNovo({ nome: '', preco: '', unidade: 'un' })
      })
      .catch((e) => {
        setErro(mensagemErro(e))
        setLinhas([])
      })
  }, [])

  // Avisa se já existe dia nessa data
  useEffect(() => {
    carregarDiaPorData(data)
      .then((d) => setDiaExistente(d?.dia.id ?? null))
      .catch(() => setDiaExistente(null))
  }, [data])

  const alterar = (i: number, campos: Partial<Linha>) => setLinhas((ls) => ls!.map((l, j) => (j === i ? { ...l, ...campos } : l)))

  const escolhidos = (linhas ?? []).filter((l) => l.marcado)
  const lidos = escolhidos.map((l) => ({ ...l, q: lerQtd(l.quantidade), p: lerReais(l.preco) }))
  const invalidos = lidos.filter((l) => Number.isNaN(l.q) || l.p === null)
  const comEstoque = lidos.filter((l) => typeof l.q === 'number' && !Number.isNaN(l.q))
  const podeVenderTudo = comEstoque.length === lidos.length && lidos.length > 0
  const totalPossivel = comEstoque.reduce((s, l) => s + (l.q ?? 0) * (l.p ?? 0), 0)

  async function abrir() {
    if (data > hoje) return setErro('Não dá para abrir um dia no futuro.')
    if (diaExistente) return setErro('Já existe um dia nessa data.')
    if (!lidos.length) return setErro('Escolha ao menos um produto.')
    if (invalidos.length) return setErro(`Confira preço e quantidade de: ${invalidos.map((l) => l.produto.nome).join(', ')}.`)
    setErro(null)
    setEnviando(true)
    try {
      const id = await abrirDia(
        data,
        lidos.map((l) => ({ produtoId: l.produto.id, produzido: l.q as number | null, preco: l.p! })),
      )
      nav(data === hoje ? '/' : `/dia/${id}`, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
    }
  }

  async function adicionarNovo() {
    if (!novo) return
    const preco = lerReais(novo.preco)
    if (!novo.nome.trim() || preco === null) return setErro('Preencha o nome e o preço do produto novo.')
    setErro(null)
    try {
      const p = await criarProduto({ nome: novo.nome, preco, unidade: novo.unidade, categoria: null })
      setLinhas((ls) => [...(ls ?? []).filter((l) => l.produto.id !== p.id), { produto: p, marcado: true, quantidade: '', preco: numeroBR(p.preco) }])
      setNovo(null)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <Pagina>
      <Topo titulo="Abrir dia de vendas" sub={dataLonga(data)} voltar={-1} />
      {linhas === null ? (
        <Carregando />
      ) : (
        <div className="space-y-3">
          <section className="cartao space-y-2 p-4">
            {outraData ? (
              <>
                <label htmlFor="data" className="rotulo block">
                  Data do dia
                </label>
                <input id="data" type="date" className="campo" value={data} max={hoje} onChange={(e) => setData(e.target.value || hoje)} />
                <p className="text-xs text-sec">Para lançar um dia que já passou. As vendas entram com essa data.</p>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Hoje, {dataLonga(hoje).split(', ')[1]}</p>
                <button type="button" className="text-sm font-semibold text-claro underline" onClick={() => setOutraData(true)}>
                  Outra data
                </button>
              </div>
            )}
            {diaExistente && (
              <Aviso>
                Já existe um dia nessa data.{' '}
                <Link to={data === hoje ? '/' : `/dia/${diaExistente}`} className="font-bold underline">
                  Abrir esse dia
                </Link>
              </Aviso>
            )}
          </section>

          <p className="px-1 text-sm text-sec">
            Marque o que vai vender. <strong className="text-texto">Quantidade</strong> é opcional: deixe em branco para vender sem controle de estoque.
          </p>

          {linhas.map((l, i) => (
            <fieldset key={l.produto.id} className={`cartao p-4 ${l.marcado ? '' : 'opacity-60'}`}>
              <legend className="sr-only">{l.produto.nome}</legend>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" className="size-5 accent-[#4B8DFF]" checked={l.marcado} onChange={(e) => alterar(i, { marcado: e.target.checked })} />
                <span className="min-w-0 flex-1 truncate text-lg font-bold">{l.produto.nome}</span>
                <span className="text-sm text-sec">por {l.produto.unidade}</span>
              </label>
              {l.marcado && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Campo id={`q-${i}`} rotulo="Quantidade" valor={l.quantidade} onChange={(v) => alterar(i, { quantidade: v })} modo="numeric" placeholder="sem limite" />
                  <Campo id={`p-${i}`} rotulo="Preço (R$)" valor={l.preco} onChange={(v) => alterar(i, { preco: v })} modo="decimal" placeholder="0,00" />
                </div>
              )}
            </fieldset>
          ))}

          {novo ? (
            <fieldset className="cartao space-y-3 border-dashed p-4">
              <legend className="sr-only">Produto novo</legend>
              <Campo id="novo-nome" rotulo="Nome do produto" valor={novo.nome} onChange={(v) => setNovo({ ...novo, nome: v })} modo="text" autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <Campo id="novo-preco" rotulo="Preço (R$)" valor={novo.preco} onChange={(v) => setNovo({ ...novo, preco: v })} modo="decimal" />
                <div className="space-y-1.5">
                  <label htmlFor="novo-un" className="rotulo block">
                    Unidade
                  </label>
                  <input id="novo-un" className="campo" list="unidades" value={novo.unidade} onChange={(e) => setNovo({ ...novo, unidade: e.target.value })} />
                  <datalist id="unidades">
                    {UNIDADES.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="flex gap-2">
                {linhas.length > 0 && (
                  <button type="button" className="btn-secundario flex-1" onClick={() => setNovo(null)}>
                    Cancelar
                  </button>
                )}
                <button type="button" className="btn-primario flex-1" onClick={adicionarNovo} disabled={!online}>
                  Cadastrar produto
                </button>
              </div>
            </fieldset>
          ) : (
            <button
              type="button"
              className="btn min-h-14 w-full rounded-2xl border border-dashed border-borda text-claro hover:border-destaque"
              onClick={() => setNovo({ nome: '', preco: '', unidade: 'un' })}
            >
              <Icone nome="mais" /> Cadastrar produto novo
            </button>
          )}

          {lidos.length > 0 && (
            <div className="cartao num space-y-1.5 p-4">
              <div className="flex justify-between">
                <span className="text-sec">Produtos no dia</span>
                <span className="font-bold">{lidos.length}</span>
              </div>
              {podeVenderTudo && (
                <div className="flex justify-between">
                  <span className="text-sec">Se vender tudo</span>
                  <span className="font-bold text-positivo">{reais(totalPossivel)}</span>
                </div>
              )}
            </div>
          )}

          {erro && <Aviso>{erro}</Aviso>}
        </div>
      )}
      <Rodape>
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={abrir} disabled={enviando || !online || !linhas || Boolean(diaExistente)}>
          {enviando ? 'Abrindo…' : data === hoje ? 'Abrir o dia de hoje' : `Abrir o dia ${data.split('-').reverse().join('/')}`}
        </button>
      </Rodape>
    </Pagina>
  )
}
