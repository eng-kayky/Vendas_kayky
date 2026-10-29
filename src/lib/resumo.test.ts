import { describe, expect, it } from 'vitest'
import {
  calcularLucro,
  calcularResumo,
  criarSnapshot,
  criarSnapshotLancamento,
  descontoVenda,
  estoqueBaixo,
  imagemDoSnapshot,
  validarLancamento,
  type ItemCalc,
  type VendaCalc,
} from './resumo'

const itens: ItemCalc[] = [
  { id: 'frango', nome: 'Empada de frango', produzido: 40, preco: 600 },
  { id: 'palmito', nome: 'Empada de palmito', produzido: 30, preco: 600 },
  { id: 'pudim', nome: 'Pudim', produzido: 20, preco: 800 },
]

const vendas: VendaCalc[] = [
  // frango: 28 un, R$ 164,00
  { item_dia_id: 'frango', quantidade: 20, valor_cobrado: 12000, pagamento: 'pix' },
  { item_dia_id: 'frango', quantidade: 8, valor_cobrado: 4400, pagamento: 'dinheiro' },
  // palmito: 24 un, R$ 138,00
  { item_dia_id: 'palmito', quantidade: 15, valor_cobrado: 9000, pagamento: 'pix' },
  { item_dia_id: 'palmito', quantidade: 4, valor_cobrado: 2400, pagamento: 'cartao' },
  { item_dia_id: 'palmito', quantidade: 5, valor_cobrado: 2400, pagamento: 'dinheiro' },
  // pudim: 9 un, R$ 68,00
  { item_dia_id: 'pudim', quantidade: 2, valor_cobrado: 1600, pagamento: 'cartao' },
  { item_dia_id: 'pudim', quantidade: 7, valor_cobrado: 5200, pagamento: 'dinheiro' },
]

describe('calcularResumo', () => {
  const r = calcularResumo(itens, vendas)

  it('calcula os totais de vendas do dia', () => {
    expect(r.totais.bruto).toBe(38400)
    expect(r.totais.descontos).toBe(1400)
    expect(r.totais.liquido).toBe(37000)
    expect(r.totais.sobra_unidades).toBe(29)
    expect(r.totais.produzido).toBe(90)
    expect(r.totais.vendido).toBe(61)
    expect(r.totais.vendas).toBe(7)
  })

  it('calcula por produto', () => {
    expect(r.itens.map((i) => i.vendido)).toEqual([28, 24, 9])
    expect(r.itens.map((i) => i.faturado)).toEqual([16400, 13800, 6800])
    expect(r.itens.map((i) => i.restante)).toEqual([12, 6, 11])
  })

  it('soma por forma de pagamento', () => {
    expect(r.pagamentos).toEqual({ pix: 21000, dinheiro: 12000, cartao: 4000 })
  })

  it('venda acima do estoque deixa o restante negativo', () => {
    const r2 = calcularResumo([itens[2]], [{ item_dia_id: 'pudim', quantidade: 22, valor_cobrado: 17600, pagamento: 'pix' }])
    expect(r2.itens[0].restante).toBe(-2)
  })
})

describe('lucro com gasto informado ao finalizar', () => {
  it('desconta o gasto do líquido', () => {
    const { lucro, margem } = calcularLucro(37000, 24500)
    expect(lucro).toBe(12500)
    expect(Math.round(margem! * 1000) / 10).toBe(33.8)
  })

  it('sem gasto (N/A) o lucro é o líquido', () => {
    expect(calcularLucro(37000, null)).toEqual({ lucro: 37000, margem: 1 })
  })

  it('margem é null quando o líquido é zero', () => {
    expect(calcularLucro(0, 1000)).toEqual({ lucro: -1000, margem: null })
  })
})

describe('regras auxiliares', () => {
  it('desconto e acréscimo', () => {
    expect(descontoVenda(2, 600, 1100)).toBe(100)
    expect(descontoVenda(1, 600, 700)).toBe(-100)
  })

  it('estoque baixo com 20% ou menos', () => {
    expect(estoqueBaixo(6, 30)).toBe(true)
    expect(estoqueBaixo(7, 30)).toBe(false)
    expect(estoqueBaixo(-1, 20)).toBe(true)
  })
})

describe('lançamento de dia anterior por resumo', () => {
  const linhas = [
    { nome: 'Empada de frango', produzido: 30, vendido: 26, faturado: 15600 },
    { nome: 'Pudim', produzido: null, vendido: 8, faturado: 4000 },
  ]

  it('monta o snapshot com sobra, lucro e gasto', () => {
    const s = criarSnapshotLancamento('2026-10-25', linhas, { pix: 12000, dinheiro: 6000, cartao: 1600 }, 8000, 'x')
    expect(s.tipo).toBe('resumo')
    expect(s.totais.liquido).toBe(196)
    expect(s.totais.lucro).toBe(116)
    expect(s.totais.sobra_unidades).toBe(4) // pudim sem "tinha" conta como sem sobra
    expect(s.itens[1].produzido).toBe(8)
    const img = imagemDoSnapshot(JSON.parse(JSON.stringify(s)))
    expect(img.resumido).toBe(true)
    expect(img.lucro).toBe(11600)
  })

  it('pagamentos são opcionais, mas se informados têm de bater', () => {
    expect(validarLancamento(linhas, null)).toBeNull()
    expect(validarLancamento(linhas, { pix: 12000, dinheiro: 6000, cartao: 1600 })).toBeNull()
    expect(validarLancamento(linhas, { pix: 12000, dinheiro: 0, cartao: 0 })).toMatch(/diferente/)
  })

  it('recusa vender mais do que tinha e lançamento vazio', () => {
    expect(validarLancamento([{ nome: 'X', produzido: 2, vendido: 3, faturado: 100 }], null)).toMatch(/vendeu mais/)
    expect(validarLancamento([], null)).toMatch(/pelo menos um/)
  })
})

describe('snapshot', () => {
  const r = calcularResumo(itens, vendas)

  it('ida e volta sem perder centavos, com gasto', () => {
    const s = criarSnapshot('2026-10-29', r, 24550, '2026-10-29T23:00:00Z')
    expect(s.totais.gasto).toBe(245.5)
    expect(s.totais.lucro).toBe(124.5)
    const img = imagemDoSnapshot(JSON.parse(JSON.stringify(s)))
    expect(img.gasto).toBe(24550)
    expect(img.lucro).toBe(12450)
    expect(img.liquido).toBe(37000)
    expect(img.produzido).toBe(90)
  })

  it('sem gasto (N/A) grava null', () => {
    const s = criarSnapshot('2026-10-29', r, null, '2026-10-29T23:00:00Z')
    expect(s.totais.gasto).toBeNull()
    expect(imagemDoSnapshot(JSON.parse(JSON.stringify(s))).gasto).toBeNull()
    expect(s.totais.lucro).toBe(370)
  })
})
