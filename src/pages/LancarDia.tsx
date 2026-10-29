import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  carregarDiaPorId,
  diaJaExiste,
  editarLancamento,
  excluirLancamento,
  lancarDiaAnterior,
  listarProdutos,
  mensagemErro,
} from '../lib/api'
import { dataLonga, hojeBelem } from '../lib/datas'
import { lerReais, numeroBR, porcentagem, reais } from '../lib/dinheiro'
import { calcularLucro, criarSnapshotLancamento, validarLancamento, type LinhaLancamento, type Pagamento } from '../lib/resumo'
import { useOnline } from '../hooks'
import { Aviso, Carregando, Confirmar, Pagina, Rodape, Topo } from '../components/ui'

interface Linha {
  chave: string
  nome: string
  preco: number // preço do cadastro, só para sugerir o valor recebido
  tinha: string
  vendeu: string
  recebeu: string
  recebeuEditado: boolean
}

const PG: { valor: Pagamento; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao', rotulo: 'Cartão' },
]

const inteiro = (s: string) => (s.trim() === '' ? null : /^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN)

/** Ontem no fuso de Belém (limite do seletor de data). */
function ontem() {
  const d = new Date(`${hojeBelem()}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export default function LancarDia() {
  const { diaId } = useParams()
  const editando = Boolean(diaId)
  const nav = useNavigate()
  const online = useOnline()
  const [data, setData] = useState(ontem())
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [pag, setPag] = useState<Record<Pagamento, string>>({ pix: '', dinheiro: '', cartao: '' })
  const [gastoTexto, setGastoTexto] = useState('')
  const [semGasto, setSemGasto] = useState(false)
  const [outro, setOutro] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [excluir, setExcluir] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const produtos = (await listarProdutos()).filter((p) => p.ativo)
        const base: Linha[] = produtos.map((p) => ({
          chave: p.id,
          nome: p.nome,
          preco: p.preco,
          tinha: '',
          vendeu: '',
          recebeu: '',
          recebeuEditado: false,
        }))
        if (!diaId) return setLinhas(base)

        // Edição: preenche com o que foi lançado
        const atual = await carregarDiaPorId(diaId)
        const s = atual?.dia.snapshot
        if (!s || s.tipo !== 'resumo') throw new Error('Este dia não foi lançado por resumo.')
        setData(s.data)
        const lancadas: Linha[] = s.itens.map((i) => ({
          chave: `l-${i.nome}`,
          nome: i.nome,
          preco: produtos.find((p) => p.nome === i.nome)?.preco ?? 0,
          tinha: String(i.produzido),
          vendeu: String(i.vendido),
          recebeu: numeroBR(Math.round(i.faturado * 100)),
          recebeuEditado: true,
        }))
        const nomes = new Set(lancadas.map((l) => l.nome))
        setLinhas([...lancadas, ...base.filter((b) => !nomes.has(b.nome))])
        const temPag = s.pagamentos.pix + s.pagamentos.dinheiro + s.pagamentos.cartao > 0
        if (temPag) setPag({ pix: numeroBR(s.pagamentos.pix * 100), dinheiro: numeroBR(s.pagamentos.dinheiro * 100), cartao: numeroBR(s.pagamentos.cartao * 100) })
        if (s.totais.gasto === null) setSemGasto(true)
        else setGastoTexto(numeroBR(Math.round(s.totais.gasto * 100)))
      } catch (e) {
        setErro(mensagemErro(e))
        setLinhas([])
      }
    })()
  }, [diaId])

  function alterar(i: number, campo: 'tinha' | 'vendeu' | 'recebeu', valor: string) {
    setLinhas((ls) =>
      ls!.map((l, j) => {
        if (j !== i) return l
        const n = { ...l, [campo]: valor }
        if (campo === 'recebeu') n.recebeuEditado = valor.trim() !== ''
        // Sugere o recebido = vendido × preço do cadastro, até a pessoa digitar outro valor
        if (campo === 'vendeu' && !l.recebeuEditado && l.preco) {
          const v = inteiro(valor)
          n.recebeu = v ? numeroBR(v * l.preco) : ''
        }
        return n
      }),
    )
  }

  function adicionarOutro() {
    const nome = outro.trim()
    if (!nome) return
    if (linhas?.some((l) => l.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))) return setErro('Esse produto já está na lista.')
    setLinhas((ls) => [...(ls ?? []), { chave: `n-${nome}`, nome, preco: 0, tinha: '', vendeu: '', recebeu: '', recebeuEditado: false }])
    setOutro('')
  }

  // ---- leitura e validação ----
  const usadas = (linhas ?? []).filter((l) => l.vendeu.trim() !== '' || l.tinha.trim() !== '' || l.recebeu.trim() !== '')
  const problemas: string[] = []
  const lidas: LinhaLancamento[] = usadas.map((l) => {
    const tinha = inteiro(l.tinha)
    const vendeu = inteiro(l.vendeu) ?? 0
    const recebeu = l.recebeu.trim() === '' ? 0 : lerReais(l.recebeu)
    if (Number.isNaN(tinha) || Number.isNaN(vendeu) || recebeu === null) problemas.push(l.nome)
    return { nome: l.nome, produzido: Number.isNaN(tinha) ? null : tinha, vendido: vendeu || 0, faturado: recebeu ?? 0 }
  })
  const pagInformado = PG.some((p) => pag[p.valor].trim() !== '')
  const pagLido = Object.fromEntries(PG.map((p) => [p.valor, pag[p.valor].trim() === '' ? 0 : lerReais(pag[p.valor])])) as Record<
    Pagamento,
    number | null
  >
  const pagValido = PG.every((p) => pagLido[p.valor] !== null)
  const total = lidas.reduce((s, l) => s + l.faturado, 0)
  const gastoLido = lerReais(gastoTexto)
  const gasto = semGasto ? null : gastoLido
  const gastoValido = semGasto || gastoLido !== null
  const { lucro, margem } = calcularLucro(total, gasto)

  async function salvar() {
    setErro(null)
    if (!data || data > ontem()) return setErro('Escolha uma data anterior a hoje.')
    if (problemas.length) return setErro(`Confira os números de: ${problemas.join(', ')}.`)
    if (!pagValido) return setErro('Confira os valores de Pix, Dinheiro e Cartão.')
    if (!gastoValido) return setErro('Informe o gasto com material ou marque "Não teve gasto".')
    const pagamentos = pagInformado ? (pagLido as Record<Pagamento, number>) : null
    const problema = validarLancamento(lidas.filter((l) => l.vendido > 0 || l.faturado > 0), pagamentos)
    if (problema) return setErro(problema)

    setEnviando(true)
    try {
      const snapshot = criarSnapshotLancamento(
        data,
        lidas.filter((l) => l.vendido > 0 || l.faturado > 0),
        pagamentos,
        gasto,
        new Date().toISOString(),
      )
      if (editando) {
        await editarLancamento(diaId!, snapshot)
        nav(`/resultado/${diaId}`, { replace: true })
      } else {
        if (await diaJaExiste(data)) throw new Error(`O dia ${data.split('-').reverse().join('/')} já está no histórico.`)
        const id = await lancarDiaAnterior(snapshot)
        nav(`/resultado/${id}`, { replace: true })
      }
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
    }
  }

  async function confirmarExclusao() {
    setEnviando(true)
    try {
      await excluirLancamento(diaId!)
      nav('/historico', { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
      setExcluir(false)
    }
  }

  return (
    <Pagina>
      <Topo titulo={editando ? 'Editar lançamento' : 'Lançar dia anterior'} sub={data ? dataLonga(data) : undefined} voltar="/historico" />
      {linhas === null ? (
        <Carregando />
      ) : (
        <div className="num space-y-3">
          <section className="cartao space-y-1.5 p-4">
            <label htmlFor="data" className="rotulo block">
              Data
            </label>
            <input
              id="data"
              type="date"
              className="campo"
              value={data}
              max={ontem()}
              disabled={editando}
              onChange={(e) => setData(e.target.value)}
            />
          </section>

          <p className="text-sm text-sec">Preencha só os produtos que vendeu nesse dia. "Tinha" é opcional.</p>

          {linhas.map((l, i) => (
            <fieldset key={l.chave} className="cartao p-4">
              <legend className="sr-only">{l.nome}</legend>
              <h2 className="mb-3 text-lg font-bold" aria-hidden>
                {l.nome}
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <Campo id={`t-${i}`} rotulo="Tinha" valor={l.tinha} onChange={(v) => alterar(i, 'tinha', v)} modo="numeric" />
                <Campo id={`v-${i}`} rotulo="Vendeu" valor={l.vendeu} onChange={(v) => alterar(i, 'vendeu', v)} modo="numeric" />
                <Campo id={`r-${i}`} rotulo="Recebeu R$" valor={l.recebeu} onChange={(v) => alterar(i, 'recebeu', v)} />
              </div>
            </fieldset>
          ))}

          <div className="flex gap-2">
            <label htmlFor="outro" className="sr-only">
              Outro produto
            </label>
            <input
              id="outro"
              className="campo text-base"
              placeholder="Outro produto (nome)"
              value={outro}
              onChange={(e) => setOutro(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarOutro()}
            />
            <button type="button" className="btn-secundario shrink-0" onClick={adicionarOutro}>
              + Incluir
            </button>
          </div>

          <section className="cartao space-y-2 p-4">
            <p className="rotulo">Recebido por (opcional)</p>
            <div className="grid grid-cols-3 gap-2">
              {PG.map((p) => (
                <Campo key={p.valor} id={`pg-${p.valor}`} rotulo={p.rotulo} valor={pag[p.valor]} onChange={(v) => setPag({ ...pag, [p.valor]: v })} />
              ))}
            </div>
            {pagInformado && pagValido && (
              <p className={`text-sm ${Object.values(pagLido).reduce((a, b) => a! + b!, 0) === total ? 'text-positivo' : 'text-alerta'}`}>
                Soma {reais(Object.values(pagLido).reduce((a, b) => a! + b!, 0)!)} · total dos produtos {reais(total)}
              </p>
            )}
          </section>

          <section className="cartao space-y-3 p-4">
            <label htmlFor="gasto" className="rotulo block">
              Gasto com material nesse dia
            </label>
            <div className={`flex min-h-12 items-center gap-2 rounded-xl border bg-fundo/60 px-3 ${semGasto ? 'border-borda opacity-40' : 'border-destaque'}`}>
              <span className="text-sec">R$</span>
              <input
                id="gasto"
                className="w-full bg-transparent text-xl font-bold outline-none"
                inputMode="decimal"
                placeholder="0,00"
                value={gastoTexto}
                disabled={semGasto}
                onChange={(e) => setGastoTexto(e.target.value)}
              />
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="size-5 accent-[#4B8DFF]" checked={semGasto} onChange={(e) => setSemGasto(e.target.checked)} />
              <span>
                Não teve gasto <span className="text-sec">(N/A)</span>
              </span>
            </label>
          </section>

          <section className="cartao space-y-1.5 p-4">
            <div className="flex justify-between">
              <span className="text-sec">Total recebido</span>
              <span className="font-bold">{reais(total)}</span>
            </div>
            {gastoValido && (
              <div className="flex justify-between">
                <span className="text-sec">Lucro {margem !== null ? `(${porcentagem(margem)})` : ''}</span>
                <span className={`font-bold ${lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>{reais(lucro)}</span>
              </div>
            )}
          </section>

          {erro && <Aviso>{erro}</Aviso>}

          {editando && (
            <button type="button" className="btn-perigo min-h-12 w-full" onClick={() => setExcluir(true)} disabled={!online || enviando}>
              Excluir este lançamento
            </button>
          )}
        </div>
      )}

      <Rodape>
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={salvar} disabled={enviando || !online || !linhas}>
          {enviando ? 'Salvando…' : 'Salvar dia e gerar imagem'}
        </button>
      </Rodape>

      <Confirmar
        aberto={excluir}
        titulo="Excluir este lançamento?"
        confirmar="Excluir"
        perigo
        ocupado={enviando}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluir(false)}
      >
        O dia sai do histórico. Dá para lançar de novo depois.
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
        className="campo num px-2"
        inputMode={modo}
        placeholder="—"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
}
