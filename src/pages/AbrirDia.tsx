import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { abrirDia, carregarHoje, criarProduto, mensagemErro, produtosParaAbrir } from '../lib/api'
import { diaMes, diaDaSemana, hojeBelem } from '../lib/datas'
import { lerReais, numeroBR, reais } from '../lib/dinheiro'
import { useOnline } from '../hooks'
import { Aviso, Carregando, Pagina, Rodape, Topo } from '../components/ui'

interface Linha {
  produto_id: string
  nome: string
  produzido: string
  preco: string
  custo: string
}

const paraLinha = (p: { produto_id: string; nome: string; produzido: number; preco: number; custo: number }): Linha => ({
  produto_id: p.produto_id,
  nome: p.nome,
  produzido: String(p.produzido),
  preco: numeroBR(p.preco),
  custo: numeroBR(p.custo),
})

const lerInteiro = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null)

export default function AbrirDia() {
  const nav = useNavigate()
  const online = useOnline()
  const hoje = hojeBelem()
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [novo, setNovo] = useState<{ nome: string; preco: string; custo: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        if (await carregarHoje()) return nav('/', { replace: true })
        setLinhas((await produtosParaAbrir()).map(paraLinha))
      } catch (e) {
        setErro(mensagemErro(e))
        setLinhas([])
      }
    })()
  }, [nav])

  const alterar = (i: number, campo: keyof Linha, valor: string) =>
    setLinhas((ls) => ls!.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)))

  // Valida tudo; produtos com produzido = 0 ficam fora do dia
  const lidas = (linhas ?? []).map((l) => ({
    ...l,
    n: lerInteiro(l.produzido),
    p: lerReais(l.preco),
    c: lerReais(l.custo),
  }))
  const invalidas = lidas.filter((l) => l.n === null || l.p === null || l.c === null)
  const validas = lidas.filter((l) => l.n !== null && l.p !== null && l.c !== null)
  const doDia = validas.filter((l) => l.n! > 0)
  const custoProducao = doDia.reduce((s, l) => s + l.n! * l.c!, 0)
  const venderTudo = doDia.reduce((s, l) => s + l.n! * l.p!, 0)

  async function abrir() {
    if (invalidas.length) return setErro(`Confira os valores de: ${invalidas.map((l) => l.nome).join(', ')}.`)
    if (!doDia.length) return setErro('Informe a quantidade produzida de pelo menos um produto.')
    setErro(null)
    setEnviando(true)
    try {
      await abrirDia(doDia.map((l) => ({ produto_id: l.produto_id, nome: l.nome, produzido: l.n!, preco: l.p!, custo: l.c! })))
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
    const custo = lerReais(novo.custo)
    if (!nome || preco === null || custo === null) return setErro('Preencha nome, preço e custo do produto novo.')
    if (linhas?.some((l) => l.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR')))
      return setErro('Já existe um produto com esse nome.')
    setErro(null)
    try {
      const id = await criarProduto(nome, preco, custo)
      setLinhas((ls) => [...(ls ?? []), paraLinha({ produto_id: id, nome, produzido: 0, preco, custo })])
      setNovo(null)
    } catch (e) {
      setErro(mensagemErro(e))
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
            {linhas.length ? 'Valores do último dia. Ajuste só o que mudou.' : 'Cadastre os produtos que vão ser vendidos hoje.'}
          </p>

          {linhas.map((l, i) => (
            <fieldset key={l.produto_id} className="cartao p-4">
              <legend className="sr-only">{l.nome}</legend>
              <h2 className="mb-3 text-lg font-bold" aria-hidden>
                {l.nome}
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <Campo id={`n-${i}`} rotulo="Produzido" valor={l.produzido} onChange={(v) => alterar(i, 'produzido', v)} modo="numeric" />
                <Campo id={`p-${i}`} rotulo="Preço" valor={l.preco} onChange={(v) => alterar(i, 'preco', v)} />
                <Campo id={`c-${i}`} rotulo="Custo un." valor={l.custo} onChange={(v) => alterar(i, 'custo', v)} />
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
                  onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Campo id="novo-preco" rotulo="Preço" valor={novo.preco} onChange={(v) => setNovo({ ...novo, preco: v })} />
                <Campo id="novo-custo" rotulo="Custo un." valor={novo.custo} onChange={(v) => setNovo({ ...novo, custo: v })} />
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secundario flex-1" onClick={() => setNovo(null)}>
                  Cancelar
                </button>
                <button type="button" className="btn-primario flex-1" onClick={adicionar} disabled={!online}>
                  Adicionar
                </button>
              </div>
            </fieldset>
          ) : (
            <button
              type="button"
              className="btn min-h-14 w-full rounded-2xl border border-dashed border-borda text-claro hover:border-destaque"
              onClick={() => setNovo({ nome: '', preco: '', custo: '' })}
            >
              + Adicionar produto
            </button>
          )}

          <div className="cartao num space-y-1.5 p-4">
            <Linha2 rotulo="Custo da produção" valor={reais(custoProducao)} />
            <Linha2 rotulo="Se vender tudo" valor={reais(venderTudo)} />
            <Linha2 rotulo="Lucro máximo do dia" valor={reais(venderTudo - custoProducao)} cor="text-positivo" />
          </div>

          {erro && <Aviso>{erro}</Aviso>}
        </div>
      )}
      <Rodape>
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={abrir} disabled={enviando || !online || !linhas}>
          {enviando ? 'Abrindo…' : 'Abrir o dia'}
        </button>
      </Rodape>
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

function Linha2({ rotulo, valor, cor = '' }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sec">{rotulo}</span>
      <span className={`font-bold ${cor}`}>{valor}</span>
    </div>
  )
}
