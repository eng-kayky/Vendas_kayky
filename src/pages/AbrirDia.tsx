import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { abrirDia, carregarHoje, criarProduto, mensagemErro, produtosParaAbrir, removerProduto } from '../lib/api'
import { diaMes, diaDaSemana, hojeBelem } from '../lib/datas'
import { lerReais, numeroBR, reais } from '../lib/dinheiro'
import { useOnline } from '../hooks'
import { Aviso, Carregando, Confirmar, Pagina, Rodape, Topo } from '../components/ui'

interface Linha {
  produto_id: string
  nome: string
  produzido: string
  preco: string
}

const paraLinha = (p: { produto_id: string; nome: string; produzido: number; preco: number }): Linha => ({
  produto_id: p.produto_id,
  nome: p.nome,
  produzido: '', // começa limpo todo dia; só o preço vem do último dia
  preco: p.preco ? numeroBR(p.preco) : '',
})

const lerInteiro = (s: string) => (s.trim() === '' ? 0 : /^\d+$/.test(s.trim()) ? Number(s.trim()) : null)

export default function AbrirDia() {
  const nav = useNavigate()
  const online = useOnline()
  const hoje = hojeBelem()
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [novo, setNovo] = useState<{ nome: string; preco: string } | null>(null)
  const [remover, setRemover] = useState<Linha | null>(null)
  const [removendo, setRemovendo] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        if (await carregarHoje()) return nav('/', { replace: true })
        const ps = (await produtosParaAbrir()).map(paraLinha)
        setLinhas(ps)
        if (!ps.length) setNovo({ nome: '', preco: '' })
      } catch (e) {
        setErro(mensagemErro(e))
        setLinhas([])
      }
    })()
  }, [nav])

  const alterar = (i: number, campo: keyof Linha, valor: string) =>
    setLinhas((ls) => ls!.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)))

  // Produto com quantidade vazia ou 0 fica fora do dia
  const lidas = (linhas ?? []).map((l) => ({ ...l, n: lerInteiro(l.produzido), p: lerReais(l.preco) }))
  const doDia = lidas.filter((l) => l.n !== null && l.n > 0)
  const invalidas = lidas.filter((l) => l.n === null || (l.n! > 0 && l.p === null))
  const venderTudo = doDia.reduce((s, l) => s + l.n! * (l.p ?? 0), 0)
  const unidades = doDia.reduce((s, l) => s + l.n!, 0)

  async function abrir() {
    if (invalidas.length) return setErro(`Confira quantidade e preço de: ${invalidas.map((l) => l.nome).join(', ')}.`)
    if (!doDia.length) return setErro('Informe a quantidade de pelo menos um produto.')
    setErro(null)
    setEnviando(true)
    try {
      await abrirDia(doDia.map((l) => ({ produto_id: l.produto_id, nome: l.nome, produzido: l.n!, preco: l.p! })))
      nav('/', { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setEnviando(false)
    }
  }

  async function adicionar() {
    if (!novo) return
    const nome = novo.nome.trim()
    const preco = lerReais(novo.preco)
    if (!nome || preco === null) return setErro('Preencha o nome e o preço do produto.')
    if (linhas?.some((l) => l.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR')))
      return setErro('Já existe um produto com esse nome.')
    setErro(null)
    try {
      const id = await criarProduto(nome, preco)
      setLinhas((ls) => [...(ls ?? []), paraLinha({ produto_id: id, nome, produzido: 0, preco })])
      setNovo(null)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  async function confirmarRemocao() {
    if (!remover) return
    setRemovendo(true)
    try {
      await removerProduto(remover.produto_id)
      setLinhas((ls) => ls!.filter((l) => l.produto_id !== remover.produto_id))
      setRemover(null)
    } catch (e) {
      setErro(mensagemErro(e))
      setRemover(null)
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <Pagina>
      <Topo titulo="Abrir o dia" sub={`${diaDaSemana(hoje)}, ${diaMes(hoje)}`} />
      {linhas === null ? (
        <Carregando />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-sec">
            {linhas.length
              ? 'Informe quanto tem de cada produto hoje. Deixe em branco o que não vai vender.'
              : 'Cadastre os produtos que vai vender hoje.'}
          </p>

          {linhas.map((l, i) => (
            <fieldset key={l.produto_id} className="cartao p-4">
              <legend className="sr-only">{l.nome}</legend>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="truncate text-lg font-bold" aria-hidden>
                  {l.nome}
                </h2>
                <button
                  type="button"
                  className="min-h-11 shrink-0 rounded-xl px-3 text-sm text-sec hover:bg-alerta/10 hover:text-alerta"
                  onClick={() => setRemover(l)}
                  disabled={!online}
                >
                  Remover
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Campo id={`n-${i}`} rotulo="Quantidade" valor={l.produzido} onChange={(v) => alterar(i, 'produzido', v)} modo="numeric" />
                <Campo id={`p-${i}`} rotulo="Preço (R$)" valor={l.preco} onChange={(v) => alterar(i, 'preco', v)} />
              </div>
            </fieldset>
          ))}

          {novo ? (
            <fieldset className="cartao space-y-3 border-dashed p-4">
              <legend className="sr-only">Produto novo</legend>
              <div className="space-y-1.5">
                <label htmlFor="novo-nome" className="rotulo">
                  Nome do produto
                </label>
                <input
                  id="novo-nome"
                  className="campo"
                  value={novo.nome}
                  autoFocus
                  autoCapitalize="sentences"
                  onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                />
              </div>
              <Campo id="novo-preco" rotulo="Preço (R$)" valor={novo.preco} onChange={(v) => setNovo({ ...novo, preco: v })} />
              <div className="flex gap-2">
                {linhas.length > 0 && (
                  <button type="button" className="btn-secundario flex-1" onClick={() => setNovo(null)}>
                    Cancelar
                  </button>
                )}
                <button type="button" className="btn-primario flex-1" onClick={adicionar} disabled={!online}>
                  Adicionar
                </button>
              </div>
            </fieldset>
          ) : (
            <button
              type="button"
              className="btn min-h-14 w-full rounded-2xl border border-dashed border-borda text-claro hover:border-destaque"
              onClick={() => setNovo({ nome: '', preco: '' })}
            >
              + Adicionar produto
            </button>
          )}

          {doDia.length > 0 && (
            <div className="cartao num space-y-1.5 p-4">
              <div className="flex justify-between">
                <span className="text-sec">Unidades para vender</span>
                <span className="font-bold">{unidades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sec">Se vender tudo</span>
                <span className="font-bold text-positivo">{reais(venderTudo)}</span>
              </div>
            </div>
          )}

          {erro && <Aviso>{erro}</Aviso>}
        </div>
      )}
      <Rodape>
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={abrir} disabled={enviando || !online || !linhas}>
          {enviando ? 'Abrindo…' : 'Abrir o dia'}
        </button>
      </Rodape>

      <Confirmar
        aberto={remover !== null}
        titulo={`Remover "${remover?.nome}"?`}
        confirmar="Remover"
        perigo
        ocupado={removendo}
        onConfirmar={confirmarRemocao}
        onCancelar={() => setRemover(null)}
      >
        Ele sai da lista de produtos. As vendas antigas continuam no histórico. Se cadastrar de novo com o mesmo nome, ele volta.
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
        placeholder="0"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
}
