// Relatório de um período (semana ou mês), somando os resumos dos dias finalizados. Tudo em centavos.
import { semPagamentos, type Pagamento, type SituacaoFiado, type Snapshot } from './resumo'

export type TipoPeriodo = 'semana' | 'mes'

export interface Periodo {
  tipo: TipoPeriodo
  inicio: string // AAAA-MM-DD
  fim: string // AAAA-MM-DD (inclusive)
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const paraData = (s: string) => new Date(`${s}T12:00:00Z`)
const paraTexto = (d: Date) => d.toISOString().slice(0, 10)

function somarDias(s: string, n: number) {
  const d = paraData(s)
  d.setUTCDate(d.getUTCDate() + n)
  return paraTexto(d)
}

/** Semana de segunda a domingo, ou mês do dia 1 ao último, contendo `data`. */
export function periodoDe(tipo: TipoPeriodo, data: string): Periodo {
  if (tipo === 'semana') {
    const dow = (paraData(data).getUTCDay() + 6) % 7 // segunda = 0
    const inicio = somarDias(data, -dow)
    return { tipo, inicio, fim: somarDias(inicio, 6) }
  }
  const [a, m] = data.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { tipo, inicio: `${a}-${mm}-01`, fim: `${a}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

/** Período anterior (−1) ou seguinte (+1). */
export function deslocar(p: Periodo, passo: -1 | 1): Periodo {
  if (p.tipo === 'semana') return periodoDe('semana', somarDias(p.inicio, 7 * passo))
  const [a, m] = p.inicio.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + passo, 1, 12))
  return periodoDe('mes', paraTexto(d))
}

/** "27/10 a 02/11" ou "outubro de 2026" */
export function nomePeriodo(p: Periodo) {
  if (p.tipo === 'mes') {
    const [a, m] = p.inicio.split('-').map(Number)
    const mes = MESES[m - 1]
    return `${mes[0].toUpperCase()}${mes.slice(1)} de ${a}`
  }
  const f = (s: string) => s.slice(8, 10) + '/' + s.slice(5, 7)
  return `${f(p.inicio)} a ${f(p.fim)}`
}

const c = (reais: number) => Math.round(reais * 100)

export interface Relatorio {
  dias: number
  vendas: number
  unidades: number
  bruto: number
  descontos: number
  faturamento: number // recebido + fiado
  recebido: number // Pix + Dinheiro + Cartão
  pagamentos: Record<Pagamento, number>
  fiadoAReceber: number // dos fiados do período, quanto ainda não foi pago
  gasto: number
  diasSemGasto: number
  lucro: number
  margem: number | null
  ticketMedio: number | null // faturamento ÷ vendas (só dias com venda a venda)
  produtos: { nome: string; vendido: number; sobra: number; faturado: number }[]
  porDia: { data: string; faturamento: number; lucro: number }[]
  melhorDia: { data: string; faturamento: number } | null
  clientes: { nome: string; compras: number; total: number }[]
}

export function agregarRelatorio(snapshots: Snapshot[], situacao: SituacaoFiado = {}): Relatorio {
  const pagamentos = semPagamentos()
  const produtos = new Map<string, { nome: string; vendido: number; sobra: number; faturado: number }>()
  const clientes = new Map<string, { nome: string; compras: number; total: number }>()
  const porDia: Relatorio['porDia'] = []
  let vendas = 0
  let vendasContadas = 0
  let faturamentoContado = 0
  let unidades = 0
  let bruto = 0
  let descontos = 0
  let faturamento = 0
  let gasto = 0
  let diasSemGasto = 0
  let lucro = 0
  let fiadoAReceber = 0

  for (const s of [...snapshots].sort((a, b) => a.data.localeCompare(b.data))) {
    const t = s.totais
    const fat = c(t.liquido)
    faturamento += fat
    bruto += c(t.bruto)
    descontos += c(t.descontos)
    lucro += c(t.lucro)
    if (t.gasto === null || t.gasto === undefined) diasSemGasto++
    else gasto += c(t.gasto)
    for (const k of Object.keys(pagamentos) as Pagamento[]) pagamentos[k] += c(s.pagamentos[k] ?? 0)
    porDia.push({ data: s.data, faturamento: fat, lucro: c(t.lucro) })

    if (s.tipo !== 'resumo') {
      vendas += t.vendas ?? 0
      vendasContadas += t.vendas ?? 0
      faturamentoContado += fat
    }

    for (const i of s.itens) {
      unidades += i.vendido
      const p = produtos.get(i.nome) ?? { nome: i.nome, vendido: 0, sobra: 0, faturado: 0 }
      p.vendido += i.vendido
      p.sobra += i.sobra
      p.faturado += c(i.faturado)
      produtos.set(i.nome, p)
    }

    // Fiado sem lista (lançamento por resumo ou dia antigo): não dá para saber se foi pago; conta como a receber
    if (s.vendas_lista?.length) {
      for (const v of s.vendas_lista) {
        if (v.pagamento === 'fiado' && !situacao[v.venda_id]) fiadoAReceber += c(v.valor)
        const nome = v.cliente?.trim()
        if (!nome) continue
        const chave = nome.toLocaleLowerCase('pt-BR')
        const cl = clientes.get(chave) ?? { nome, compras: 0, total: 0 }
        cl.compras++
        cl.total += c(v.valor)
        clientes.set(chave, cl)
      }
    } else fiadoAReceber += c(s.pagamentos.fiado ?? 0)
  }

  const melhor = porDia.reduce<Relatorio['melhorDia']>((m, d) => (!m || d.faturamento > m.faturamento ? { data: d.data, faturamento: d.faturamento } : m), null)

  return {
    dias: snapshots.length,
    vendas,
    unidades,
    bruto,
    descontos,
    faturamento,
    recebido: pagamentos.pix + pagamentos.dinheiro + pagamentos.cartao,
    pagamentos,
    fiadoAReceber,
    gasto,
    diasSemGasto,
    lucro,
    margem: faturamento === 0 ? null : lucro / faturamento,
    ticketMedio: vendasContadas ? Math.round(faturamentoContado / vendasContadas) : null,
    produtos: [...produtos.values()].sort((a, b) => b.faturado - a.faturado),
    porDia,
    melhorDia: melhor && melhor.faturamento > 0 ? melhor : null,
    clientes: [...clientes.values()].sort((a, b) => b.total - a.total).slice(0, 10),
  }
}
