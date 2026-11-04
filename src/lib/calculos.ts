// Cálculos do dia, das imagens e dos períodos. Funções puras, tudo em centavos.
import type { DiaCompleto, FormaRecebimento, ItemDia, Pagamento, Pedido } from './tipos'

/** Soma dos itens pelo preço de tabela (o desconto é subtotal − total cobrado). */
export const subtotalPedido = (p: Pick<Pedido, 'itens'>) => p.itens.reduce((s, i) => s + i.subtotal, 0)

/**
 * Valor de cada item já com o desconto do pedido repartido proporcionalmente.
 * A soma bate exatamente com o total (o último item absorve o arredondamento).
 */
export function valoresPorItem(p: Pick<Pedido, 'itens' | 'total'>): number[] {
  const sub = subtotalPedido(p)
  if (p.itens.length === 0) return []
  if (sub === 0) return p.itens.map((_, i) => (i === p.itens.length - 1 ? p.total : 0))
  let resto = p.total
  return p.itens.map((it, i) => {
    if (i === p.itens.length - 1) return resto
    const v = Math.round((it.subtotal * p.total) / sub)
    resto -= v
    return v
  })
}

export const fiadoPago = (p: Pedido) => p.pagamento === 'fiado' && p.fiadoPagoEm !== null
export const fiadoAberto = (p: Pedido) => p.status === 'concluido' && p.pagamento === 'fiado' && p.fiadoPagoEm === null

/** Produto "baixo" quando restam 20% ou menos (só com controle de estoque). */
export const estoqueBaixo = (restante: number | null, produzido: number | null) =>
  restante !== null && produzido !== null && produzido > 0 && restante <= produzido * 0.2

export interface LinhaProduto extends ItemDia {
  vendido: number
  reservado: number
  restante: number | null // null = sem controle de estoque
  faturado: number
}

export interface ResumoDia {
  itens: LinhaProduto[]
  vendas: number // pedidos concluídos
  unidades: number
  bruto: number // pelo preço de tabela
  descontos: number
  faturamento: number // tudo vendido (inclui fiado)
  porForma: Record<Pagamento, number> // pela forma da venda
  fiadoPago: number
  fiadoPagoPorForma: Record<FormaRecebimento, number>
  aReceber: number // fiado ainda não pago
  recebido: number // faturamento − a receber
  reservas: number
  reservadoUnidades: number
  reservadoValor: number
  disponivel: number | null // soma dos restantes (null se nenhum produto tem estoque)
  gasto: number // 0 quando não teve
  lucro: number
  margem: number | null
}

const zeroFormas = (): Record<Pagamento, number> => ({ pix: 0, dinheiro: 0, cartao: 0, fiado: 0, nao_informado: 0 })

export function resumirDia(d: DiaCompleto): ResumoDia {
  const porItem = new Map(d.itens.map((i) => [i.id, { vendido: 0, reservado: 0, faturado: 0 }]))
  const porForma = zeroFormas()
  const fiadoPagoPorForma: Record<FormaRecebimento, number> = { pix: 0, dinheiro: 0, cartao: 0 }
  let vendas = 0
  let bruto = 0
  let faturamento = 0
  let fiadoPagoTotal = 0
  let aReceber = 0
  let reservas = 0
  let reservadoValor = 0

  for (const p of d.pedidos) {
    if (p.status === 'reservado') {
      reservas++
      reservadoValor += p.total
      for (const it of p.itens) {
        const acc = porItem.get(it.itemDiaId)
        if (acc) acc.reservado += it.quantidade
      }
      continue
    }
    vendas++
    faturamento += p.total
    bruto += subtotalPedido(p)
    if (p.pagamento) porForma[p.pagamento] += p.total
    if (fiadoPago(p)) {
      fiadoPagoTotal += p.total
      fiadoPagoPorForma[p.fiadoPagoCom!] += p.total
    } else if (fiadoAberto(p)) aReceber += p.total
    const valores = valoresPorItem(p)
    p.itens.forEach((it, k) => {
      const acc = porItem.get(it.itemDiaId)
      if (!acc) return
      acc.vendido += it.quantidade
      acc.faturado += valores[k]
    })
  }

  const itens: LinhaProduto[] = d.itens.map((i) => {
    const acc = porItem.get(i.id)!
    return { ...i, ...acc, restante: i.produzido === null ? null : i.produzido - acc.vendido - acc.reservado }
  })
  const comEstoque = itens.filter((i) => i.restante !== null)
  const gasto = d.dia.gasto ?? 0
  const lucro = faturamento - gasto

  return {
    itens,
    vendas,
    unidades: itens.reduce((s, i) => s + i.vendido, 0),
    bruto,
    descontos: bruto - faturamento,
    faturamento,
    porForma,
    fiadoPago: fiadoPagoTotal,
    fiadoPagoPorForma,
    aReceber,
    recebido: faturamento - aReceber,
    reservas,
    reservadoUnidades: itens.reduce((s, i) => s + i.reservado, 0),
    reservadoValor,
    disponivel: comEstoque.length ? comEstoque.reduce((s, i) => s + i.restante!, 0) : null,
    gasto,
    lucro,
    margem: faturamento === 0 ? null : lucro / faturamento,
  }
}

// ---------- Lista de vendas separada por produto (tela do dia e imagem) ----------

export interface LinhaVenda {
  pedidoId: string
  hora: string
  cliente: string | null
  quantidade: number
  valor: number
  pagamento: Pagamento
  fiadoPagoEm: string | null
  fiadoPagoCom: FormaRecebimento | null
}

export interface GrupoProduto {
  itemDiaId: string
  produto: string
  unidade: string
  quantidade: number
  valor: number
  linhas: LinhaVenda[]
}

/** Vendas concluídas agrupadas por produto (na ordem dos produtos do dia), cada grupo por hora. */
export function vendasPorProduto(d: DiaCompleto): GrupoProduto[] {
  const grupos = new Map<string, GrupoProduto>(
    d.itens.map((i) => [i.id, { itemDiaId: i.id, produto: i.nome, unidade: i.unidade, quantidade: 0, valor: 0, linhas: [] }]),
  )
  for (const p of d.pedidos) {
    if (p.status !== 'concluido' || !p.pagamento) continue
    const valores = valoresPorItem(p)
    p.itens.forEach((it, k) => {
      const g = grupos.get(it.itemDiaId)
      if (!g) return
      g.quantidade += it.quantidade
      g.valor += valores[k]
      g.linhas.push({
        pedidoId: p.id,
        hora: p.criadoEm,
        cliente: p.cliente,
        quantidade: it.quantidade,
        valor: valores[k],
        pagamento: p.pagamento!,
        fiadoPagoEm: p.fiadoPagoEm,
        fiadoPagoCom: p.fiadoPagoCom,
      })
    })
  }
  return [...grupos.values()]
    .filter((g) => g.linhas.length)
    .map((g) => ({ ...g, linhas: g.linhas.sort((a, b) => a.hora.localeCompare(b.hora)) }))
}

/** Um bloco de página: título do produto (ou a continuação dele) e as linhas que couberem. */
export interface BlocoPagina {
  grupo: GrupoProduto
  continuacao: boolean
  linhas: LinhaVenda[]
}

/**
 * Distribui os grupos em páginas. `capacidades` = linhas que cabem em cada página (a primeira tem
 * o cabeçalho de resumo, então cabe menos); um título de produto ocupa `pesoTitulo` linhas.
 */
export function paginarGrupos(grupos: GrupoProduto[], capacidades: { primeira: number; demais: number }, pesoTitulo = 1.7) {
  const paginas: BlocoPagina[][] = [[]]
  let livre = capacidades.primeira
  for (const g of grupos) {
    let resto = g.linhas
    let continuacao = false
    while (resto.length) {
      if (livre < pesoTitulo + 1) {
        paginas.push([])
        livre = capacidades.demais
      }
      livre -= pesoTitulo
      const parte = resto.slice(0, Math.max(1, Math.floor(livre)))
      paginas[paginas.length - 1].push({ grupo: g, continuacao, linhas: parte })
      livre -= parte.length
      resto = resto.slice(parte.length)
      continuacao = true
    }
  }
  return paginas.filter((p) => p.length)
}

// ---------- Períodos (semana / mês) ----------

export type TipoPeriodo = 'semana' | 'mes'
export interface Periodo {
  tipo: TipoPeriodo
  inicio: string
  fim: string // inclusive
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const paraData = (s: string) => new Date(`${s}T12:00:00Z`)
const paraTexto = (d: Date) => d.toISOString().slice(0, 10)

export function somarDias(s: string, n: number) {
  const d = paraData(s)
  d.setUTCDate(d.getUTCDate() + n)
  return paraTexto(d)
}

/** Semana de segunda a domingo, ou mês inteiro, contendo `data`. */
export function periodoDe(tipo: TipoPeriodo, data: string): Periodo {
  if (tipo === 'semana') {
    const inicio = somarDias(data, -((paraData(data).getUTCDay() + 6) % 7))
    return { tipo, inicio, fim: somarDias(inicio, 6) }
  }
  const [a, m] = data.split('-').map(Number)
  const mm = String(m).padStart(2, '0')
  return { tipo, inicio: `${a}-${mm}-01`, fim: `${a}-${mm}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}` }
}

export function deslocar(p: Periodo, passo: -1 | 1): Periodo {
  if (p.tipo === 'semana') return periodoDe('semana', somarDias(p.inicio, 7 * passo))
  const [a, m] = p.inicio.split('-').map(Number)
  return periodoDe('mes', paraTexto(new Date(Date.UTC(a, m - 1 + passo, 1, 12))))
}

export function nomePeriodo(p: Periodo) {
  if (p.tipo === 'mes') {
    const [a, m] = p.inicio.split('-').map(Number)
    return `${MESES[m - 1]} de ${a}`
  }
  const f = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
  return `${f(p.inicio)} a ${f(p.fim)}`
}

// ---------- Relatório de um período (dias fechados) ----------

export interface Relatorio {
  dias: number
  vendas: number
  unidades: number
  bruto: number
  descontos: number
  faturamento: number
  recebido: number
  aReceber: number
  porForma: Record<Pagamento, number>
  gasto: number
  diasSemGasto: number
  lucro: number
  margem: number | null
  ticketMedio: number | null
  produtos: { nome: string; unidade: string; vendido: number; faturado: number }[]
  porDia: { data: string; faturamento: number; lucro: number }[]
  melhorDia: { data: string; faturamento: number } | null
  clientes: { nome: string; compras: number; total: number }[]
}

export function agregarRelatorio(dias: DiaCompleto[]): Relatorio {
  const porForma = zeroFormas()
  const produtos = new Map<string, Relatorio['produtos'][number]>()
  const clientes = new Map<string, Relatorio['clientes'][number]>()
  const porDia: Relatorio['porDia'] = []
  const soma = { vendas: 0, unidades: 0, bruto: 0, descontos: 0, faturamento: 0, recebido: 0, aReceber: 0, gasto: 0, semGasto: 0, lucro: 0 }

  for (const d of [...dias].sort((a, b) => a.dia.data.localeCompare(b.dia.data))) {
    const r = resumirDia(d)
    soma.vendas += r.vendas
    soma.unidades += r.unidades
    soma.bruto += r.bruto
    soma.descontos += r.descontos
    soma.faturamento += r.faturamento
    soma.recebido += r.recebido
    soma.aReceber += r.aReceber
    soma.gasto += r.gasto
    soma.lucro += r.lucro
    if (d.dia.semGasto) soma.semGasto++
    for (const k of Object.keys(porForma) as Pagamento[]) porForma[k] += r.porForma[k]
    porDia.push({ data: d.dia.data, faturamento: r.faturamento, lucro: r.lucro })

    for (const i of r.itens) {
      if (!i.vendido) continue
      const chave = i.nome.toLocaleLowerCase('pt-BR')
      const p = produtos.get(chave) ?? { nome: i.nome, unidade: i.unidade, vendido: 0, faturado: 0 }
      p.vendido += i.vendido
      p.faturado += i.faturado
      produtos.set(chave, p)
    }
    for (const p of d.pedidos) {
      if (p.status !== 'concluido' || !p.cliente) continue
      const chave = p.cliente.toLocaleLowerCase('pt-BR')
      const c = clientes.get(chave) ?? { nome: p.cliente, compras: 0, total: 0 }
      c.compras++
      c.total += p.total
      clientes.set(chave, c)
    }
  }

  const melhor = porDia.reduce<Relatorio['melhorDia']>((m, d) => (!m || d.faturamento > m.faturamento ? { ...d } : m), null)
  return {
    dias: dias.length,
    vendas: soma.vendas,
    unidades: soma.unidades,
    bruto: soma.bruto,
    descontos: soma.descontos,
    faturamento: soma.faturamento,
    recebido: soma.recebido,
    aReceber: soma.aReceber,
    porForma,
    gasto: soma.gasto,
    diasSemGasto: soma.semGasto,
    lucro: soma.lucro,
    margem: soma.faturamento === 0 ? null : soma.lucro / soma.faturamento,
    ticketMedio: soma.vendas ? Math.round(soma.faturamento / soma.vendas) : null,
    produtos: [...produtos.values()].sort((a, b) => b.faturado - a.faturado),
    porDia,
    melhorDia: melhor && melhor.faturamento > 0 ? { data: melhor.data, faturamento: melhor.faturamento } : null,
    clientes: [...clientes.values()].sort((a, b) => b.total - a.total).slice(0, 10),
  }
}

// ---------- Carrinho da tela de venda ----------

export interface LinhaCarrinho {
  itemDiaId: string
  quantidade: number
  precoUnit: number
}

export const subtotalCarrinho = (c: LinhaCarrinho[]) => c.reduce((s, l) => s + l.quantidade * l.precoUnit, 0)

/** Quantas unidades de cada produto ainda dá para vender, descontando o que está no carrinho. */
export function disponivelNoCarrinho(linha: LinhaProduto, carrinho: LinhaCarrinho[], devolver = 0): number | null {
  if (linha.restante === null) return null
  const noCarrinho = carrinho.find((c) => c.itemDiaId === linha.id)?.quantidade ?? 0
  return linha.restante + devolver - noCarrinho
}
