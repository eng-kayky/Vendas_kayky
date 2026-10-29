import { describe, expect, it } from 'vitest'
import { calcularResumo, criarSnapshot, descontoVenda, estoqueBaixo, imagemDoSnapshot, type ItemCalc, type VendaCalc } from './resumo'

// Caso de aceite (item 10 do prompt)
const itens: ItemCalc[] = [
  { id: 'frango', nome: 'Empada de frango', produzido: 40, preco: 600, custo: 250 },
  { id: 'palmito', nome: 'Empada de palmito', produzido: 30, preco: 600, custo: 250 },
  { id: 'pudim', nome: 'Pudim', produzido: 20, preco: 800, custo: 350 },
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

  it('calcula os totais do dia', () => {
    expect(r.totais.bruto).toBe(38400)
    expect(r.totais.descontos).toBe(1400)
    expect(r.totais.liquido).toBe(37000)
    expect(r.totais.custo).toBe(24500)
    expect(r.totais.lucro).toBe(12500)
    expect(Math.round(r.totais.margem! * 1000) / 10).toBe(33.8)
    expect(r.totais.sobra_unidades).toBe(29)
    expect(r.totais.sobra_custo).toBe(8350)
    expect(r.totais.produzido).toBe(90)
    expect(r.totais.vendido).toBe(61)
  })

  it('calcula o lucro por produto', () => {
    expect(r.itens.map((i) => i.lucro)).toEqual([6400, 6300, -200])
    expect(r.itens.map((i) => i.vendido)).toEqual([28, 24, 9])
    expect(r.itens.map((i) => i.faturado)).toEqual([16400, 13800, 6800])
    expect(r.itens.map((i) => i.restante)).toEqual([12, 6, 11])
  })

  it('soma por forma de pagamento', () => {
    expect(r.pagamentos).toEqual({ pix: 21000, dinheiro: 12000, cartao: 4000 })
  })

  it('margem é null quando o líquido é zero', () => {
    const vazio = calcularResumo(itens, [])
    expect(vazio.totais.margem).toBeNull()
    expect(vazio.totais.lucro).toBe(-24500)
    expect(vazio.totais.sobra_unidades).toBe(90)
  })

  it('venda acima do estoque deixa o restante negativo', () => {
    const r2 = calcularResumo([itens[2]], [{ item_dia_id: 'pudim', quantidade: 22, valor_cobrado: 17600, pagamento: 'pix' }])
    expect(r2.itens[0].restante).toBe(-2)
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
    expect(estoqueBaixo(4, 20)).toBe(true)
    expect(estoqueBaixo(-1, 20)).toBe(true)
  })
})

describe('snapshot', () => {
  it('ida e volta sem perder centavos', () => {
    const r = calcularResumo(itens, vendas)
    const s = criarSnapshot('2026-10-29', r, '2026-10-29T23:00:00Z')
    expect(s.totais.lucro).toBe(125)
    expect(s.totais.margem).toBe(0.3378)
    expect(s.pagamentos.pix).toBe(210)
    const img = imagemDoSnapshot(JSON.parse(JSON.stringify(s)))
    expect(img.lucro).toBe(12500)
    expect(img.sobra_custo).toBe(8350)
    expect(img.itens[2].lucro).toBe(-200)
    expect(img.produzido).toBe(90)
  })
})
