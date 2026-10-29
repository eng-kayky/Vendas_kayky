// Regras de cálculo do dia. Funções puras, tudo em centavos.
// O dia controla só vendas; o gasto com material é informado ao finalizar.

// Fiado conta no faturamento do dia da venda e fica "a receber" até o cliente pagar
export type Pagamento = 'pix' | 'dinheiro' | 'cartao' | 'fiado'
export type FormaRecebimento = Exclude<Pagamento, 'fiado'>

export const PAGAMENTOS: { valor: Pagamento; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'fiado', rotulo: 'Fiado' },
]

export const FORMAS_RECEBIMENTO = PAGAMENTOS.filter((p) => p.valor !== 'fiado') as { valor: FormaRecebimento; rotulo: string }[]

/** Pix e fiado exigem o nome do cliente. */
export const exigeCliente = (p: Pagamento) => p === 'pix' || p === 'fiado'

export const semPagamentos = (): Record<Pagamento, number> => ({ pix: 0, dinheiro: 0, cartao: 0, fiado: 0 })

export interface ItemCalc {
  id: string
  nome: string
  produzido: number
  preco: number // centavos
}

export interface VendaCalc {
  item_dia_id: string
  quantidade: number
  valor_cobrado: number // centavos
  pagamento: Pagamento
}

export interface LinhaResumo extends ItemCalc {
  vendido: number
  restante: number
  bruto: number
  faturado: number
}

export interface Resumo {
  itens: LinhaResumo[]
  totais: {
    produzido: number
    vendido: number
    vendas: number // número de vendas registradas
    bruto: number
    descontos: number
    liquido: number
    sobra_unidades: number
  }
  pagamentos: Record<Pagamento, number>
}

/** Desconto da venda: positivo = desconto, negativo = acréscimo. */
export function descontoVenda(quantidade: number, preco: number, valorCobrado: number): number {
  return quantidade * preco - valorCobrado
}

/** Produto "Baixo" quando resta 20% ou menos da produção. */
export function estoqueBaixo(restante: number, produzido: number): boolean {
  return produzido > 0 && restante <= produzido * 0.2
}

export function calcularResumo(itens: ItemCalc[], vendas: VendaCalc[]): Resumo {
  const pagamentos = semPagamentos()
  const porItem = new Map<string, { vendido: number; faturado: number }>()

  for (const v of vendas) {
    const acc = porItem.get(v.item_dia_id) ?? { vendido: 0, faturado: 0 }
    acc.vendido += v.quantidade
    acc.faturado += v.valor_cobrado
    porItem.set(v.item_dia_id, acc)
    pagamentos[v.pagamento] += v.valor_cobrado
  }

  const linhas: LinhaResumo[] = itens.map((i) => {
    const { vendido, faturado } = porItem.get(i.id) ?? { vendido: 0, faturado: 0 }
    return { ...i, vendido, restante: i.produzido - vendido, bruto: vendido * i.preco, faturado }
  })

  const soma = (f: (l: LinhaResumo) => number) => linhas.reduce((s, l) => s + f(l), 0)
  const bruto = soma((l) => l.bruto)
  const liquido = soma((l) => l.faturado)

  return {
    itens: linhas,
    totais: {
      produzido: soma((l) => l.produzido),
      vendido: soma((l) => l.vendido),
      vendas: vendas.length,
      bruto,
      descontos: bruto - liquido,
      liquido,
      sobra_unidades: soma((l) => l.restante),
    },
    pagamentos,
  }
}

/** Lucro do dia: líquido − gasto com material (sem gasto = 0). Margem null se líquido = 0. */
export function calcularLucro(liquido: number, gasto: number | null) {
  const lucro = liquido - (gasto ?? 0)
  return { lucro, margem: liquido === 0 ? null : lucro / liquido }
}

// ---------- Snapshot gravado ao finalizar (valores em reais, como no banco) ----------

export interface Snapshot {
  data: string
  tipo?: 'resumo' // dia anterior lançado só com os totais (sem venda a venda)
  itens: { nome: string; produzido: number; vendido: number; sobra: number; faturado: number }[]
  totais: {
    vendas: number
    bruto: number
    descontos: number
    liquido: number
    gasto: number | null // null = não teve gasto (N/A)
    lucro: number
    margem: number | null
    sobra_unidades: number
  }
  pagamentos: Record<Pagamento, number> // fiado = vendido fiado nesse dia (a receber)
  fiado_recebido?: number // fiados de dias anteriores pagos nesse dia (entrou no caixa, não no faturamento)
  fechado_em: string
}

const r = (centavos: number) => centavos / 100
const c = (reais: number) => Math.round(reais * 100)

const pagamentosEmReais = (p: Record<Pagamento, number>): Record<Pagamento, number> => ({
  pix: r(p.pix),
  dinheiro: r(p.dinheiro),
  cartao: r(p.cartao),
  fiado: r(p.fiado),
})

export function criarSnapshot(
  data: string,
  resumo: Resumo,
  gasto: number | null,
  fechadoEm: string,
  fiadoRecebido = 0,
): Snapshot {
  const t = resumo.totais
  const { lucro, margem } = calcularLucro(t.liquido, gasto)
  return {
    data,
    itens: resumo.itens.map((l) => ({
      nome: l.nome,
      produzido: l.produzido,
      vendido: l.vendido,
      sobra: l.restante,
      faturado: r(l.faturado),
    })),
    totais: {
      vendas: t.vendas,
      bruto: r(t.bruto),
      descontos: r(t.descontos),
      liquido: r(t.liquido),
      gasto: gasto === null ? null : r(gasto),
      lucro: r(lucro),
      margem: margem === null ? null : Math.round(margem * 10000) / 10000,
      sobra_unidades: t.sobra_unidades,
    },
    pagamentos: pagamentosEmReais(resumo.pagamentos),
    fiado_recebido: r(fiadoRecebido),
    fechado_em: fechadoEm,
  }
}

// ---------- Dia anterior lançado por resumo ----------

export interface LinhaLancamento {
  nome: string
  produzido: number | null // null = não informado (considera igual ao vendido)
  vendido: number
  faturado: number // centavos
}

/** Pagamentos são opcionais; se algum for informado, a soma tem de bater com o total dos produtos. */
export function validarLancamento(linhas: LinhaLancamento[], pagamentos: Record<Pagamento, number> | null): string | null {
  if (!linhas.length) return 'Informe pelo menos um produto vendido.'
  for (const l of linhas) {
    if (l.produzido !== null && l.produzido < l.vendido) return `${l.nome}: vendeu mais do que tinha.`
  }
  if (pagamentos) {
    const total = linhas.reduce((s, l) => s + l.faturado, 0)
    const pago = pagamentos.pix + pagamentos.dinheiro + pagamentos.cartao + pagamentos.fiado
    if (pago !== total) return `A soma por pagamento (${(pago / 100).toFixed(2).replace('.', ',')}) é diferente do total dos produtos (${(total / 100).toFixed(2).replace('.', ',')}).`
  }
  return null
}

export function criarSnapshotLancamento(
  data: string,
  linhas: LinhaLancamento[],
  pagamentos: Record<Pagamento, number> | null,
  gasto: number | null,
  fechadoEm: string,
): Snapshot {
  const liquido = linhas.reduce((s, l) => s + l.faturado, 0)
  const { lucro, margem } = calcularLucro(liquido, gasto)
  const itens = linhas.map((l) => {
    const produzido = l.produzido ?? l.vendido
    return { nome: l.nome, produzido, vendido: l.vendido, sobra: produzido - l.vendido, faturado: r(l.faturado) }
  })
  const p = pagamentos ?? semPagamentos()
  return {
    data,
    tipo: 'resumo',
    itens,
    totais: {
      vendas: 0,
      bruto: r(liquido), // sem venda a venda não há preço de tabela: bruto = líquido
      descontos: 0,
      liquido: r(liquido),
      gasto: gasto === null ? null : r(gasto),
      lucro: r(lucro),
      margem: margem === null ? null : Math.round(margem * 10000) / 10000,
      sobra_unidades: itens.reduce((s, i) => s + i.sobra, 0),
    },
    pagamentos: pagamentosEmReais(p),
    fechado_em: fechadoEm,
  }
}

/** Dados da imagem, em centavos, lidos só do snapshot. */
export function imagemDoSnapshot(s: Snapshot) {
  const itens = s.itens.map((i) => ({ ...i, faturado: c(i.faturado) }))
  return {
    data: s.data,
    resumido: s.tipo === 'resumo',
    itens,
    produzido: itens.reduce((a, i) => a + i.produzido, 0),
    vendido: itens.reduce((a, i) => a + i.vendido, 0),
    vendas: s.totais.vendas ?? 0,
    bruto: c(s.totais.bruto),
    descontos: c(s.totais.descontos),
    liquido: c(s.totais.liquido),
    gasto: s.totais.gasto === null || s.totais.gasto === undefined ? null : c(s.totais.gasto),
    lucro: c(s.totais.lucro),
    margem: s.totais.margem,
    sobra_unidades: s.totais.sobra_unidades,
    // Dias fechados antes do fiado existir não têm esses campos
    pagamentos: {
      pix: c(s.pagamentos.pix),
      dinheiro: c(s.pagamentos.dinheiro),
      cartao: c(s.pagamentos.cartao),
      fiado: c(s.pagamentos.fiado ?? 0),
    },
    fiado_recebido: c(s.fiado_recebido ?? 0),
  }
}

export type DadosImagem = ReturnType<typeof imagemDoSnapshot>
