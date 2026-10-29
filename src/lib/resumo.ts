// Regras de cálculo do dia. Funções puras, tudo em centavos.

export type Pagamento = 'pix' | 'dinheiro' | 'cartao'

export const PAGAMENTOS: { valor: Pagamento; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao', rotulo: 'Cartão' },
]

export interface ItemCalc {
  id: string
  nome: string
  produzido: number
  preco: number // centavos
  custo: number // centavos
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
  custoProducao: number
  lucro: number
}

export interface Resumo {
  itens: LinhaResumo[]
  totais: {
    produzido: number
    vendido: number
    bruto: number
    descontos: number
    liquido: number
    custo: number
    lucro: number
    margem: number | null // fração (0,338); null quando líquido = 0
    sobra_unidades: number
    sobra_custo: number
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
  const pagamentos: Record<Pagamento, number> = { pix: 0, dinheiro: 0, cartao: 0 }
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
    const custoProducao = i.produzido * i.custo
    return {
      ...i,
      vendido,
      restante: i.produzido - vendido,
      bruto: vendido * i.preco,
      faturado,
      custoProducao,
      lucro: faturado - custoProducao,
    }
  })

  const soma = (f: (l: LinhaResumo) => number) => linhas.reduce((s, l) => s + f(l), 0)
  const bruto = soma((l) => l.bruto)
  const liquido = soma((l) => l.faturado)
  const custo = soma((l) => l.custoProducao)
  const lucro = liquido - custo

  return {
    itens: linhas,
    totais: {
      produzido: soma((l) => l.produzido),
      vendido: soma((l) => l.vendido),
      bruto,
      descontos: bruto - liquido,
      liquido,
      custo,
      lucro,
      margem: liquido === 0 ? null : lucro / liquido,
      sobra_unidades: soma((l) => l.restante),
      sobra_custo: soma((l) => l.restante * l.custo),
    },
    pagamentos,
  }
}

// ---------- Snapshot gravado ao finalizar (valores em reais, como no banco) ----------

export interface Snapshot {
  data: string
  itens: { nome: string; produzido: number; vendido: number; sobra: number; faturado: number; lucro: number }[]
  totais: {
    bruto: number
    descontos: number
    liquido: number
    custo: number
    lucro: number
    margem: number | null
    sobra_unidades: number
    sobra_custo: number
  }
  pagamentos: Record<Pagamento, number>
  fechado_em: string
}

const r = (centavos: number) => centavos / 100
const c = (reais: number) => Math.round(reais * 100)

export function criarSnapshot(data: string, resumo: Resumo, fechadoEm: string): Snapshot {
  const t = resumo.totais
  return {
    data,
    itens: resumo.itens.map((l) => ({
      nome: l.nome,
      produzido: l.produzido,
      vendido: l.vendido,
      sobra: l.restante,
      faturado: r(l.faturado),
      lucro: r(l.lucro),
    })),
    totais: {
      bruto: r(t.bruto),
      descontos: r(t.descontos),
      liquido: r(t.liquido),
      custo: r(t.custo),
      lucro: r(t.lucro),
      margem: t.margem === null ? null : Math.round(t.margem * 10000) / 10000,
      sobra_unidades: t.sobra_unidades,
      sobra_custo: r(t.sobra_custo),
    },
    pagamentos: {
      pix: r(resumo.pagamentos.pix),
      dinheiro: r(resumo.pagamentos.dinheiro),
      cartao: r(resumo.pagamentos.cartao),
    },
    fechado_em: fechadoEm,
  }
}

/** Dados da imagem, em centavos, lidos só do snapshot. */
export function imagemDoSnapshot(s: Snapshot) {
  const itens = s.itens.map((i) => ({ ...i, faturado: c(i.faturado), lucro: c(i.lucro) }))
  return {
    data: s.data,
    itens,
    produzido: itens.reduce((a, i) => a + i.produzido, 0),
    vendido: itens.reduce((a, i) => a + i.vendido, 0),
    bruto: c(s.totais.bruto),
    descontos: c(s.totais.descontos),
    liquido: c(s.totais.liquido),
    custo: c(s.totais.custo),
    lucro: c(s.totais.lucro),
    margem: s.totais.margem,
    sobra_unidades: s.totais.sobra_unidades,
    sobra_custo: c(s.totais.sobra_custo),
    pagamentos: { pix: c(s.pagamentos.pix), dinheiro: c(s.pagamentos.dinheiro), cartao: c(s.pagamentos.cartao) },
  }
}

export type DadosImagem = ReturnType<typeof imagemDoSnapshot>
