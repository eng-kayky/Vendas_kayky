import { describe, expect, it } from 'vitest'
import {
  agruparPorProduto,
  paginarGrupos,
  calcularLucro,
  calcularResumo,
  criarSnapshot,
  criarSnapshotLancamento,
  descontoVenda,
  estoqueBaixo,
  imagemDoSnapshot,
  listarVendasDoDia,
  totaisFiado,
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
    expect(r.pagamentos).toEqual({ pix: 21000, dinheiro: 12000, cartao: 4000, fiado: 0 })
  })

  it('fiado entra no faturamento do dia da venda e fica a receber', () => {
    const r2 = calcularResumo(itens, [...vendas, { item_dia_id: 'pudim', quantidade: 2, valor_cobrado: 1600, pagamento: 'fiado' }])
    expect(r2.totais.liquido).toBe(38600)
    expect(r2.pagamentos.fiado).toBe(1600)
    expect(r2.itens[2].vendido).toBe(11)
    expect(r2.itens[2].restante).toBe(9)
  })

  it('venda acima do estoque deixa o restante negativo', () => {
    const r2 = calcularResumo([itens[2]], [{ item_dia_id: 'pudim', quantidade: 22, valor_cobrado: 17600, pagamento: 'pix' }])
    expect(r2.itens[0].restante).toBe(-2)
  })
})

describe('reservas', () => {
  const comReserva: VendaCalc[] = [
    ...vendas,
    { item_dia_id: 'pudim', quantidade: 3, valor_cobrado: 2400, pagamento: null, status: 'reservada' },
  ]
  const r = calcularResumo(itens, comReserva)

  it('reserva tira do disponível, mas não é venda', () => {
    expect(r.itens[2].reservado).toBe(3)
    expect(r.itens[2].vendido).toBe(9)
    expect(r.itens[2].restante).toBe(8) // 20 − 9 − 3
    expect(r.totais.liquido).toBe(37000)
    expect(r.totais.vendas).toBe(7)
    expect(r.totais.reservas).toBe(1)
    expect(r.totais.reservado).toBe(3)
  })

  it('reserva não entra na lista de vendas do resumo', () => {
    const lista = listarVendasDoDia(
      itens,
      comReserva.map((v, i) => ({ ...v, id: `v${i}`, cliente: null, criado_em: `2026-10-29T1${i}:00:00Z` })),
    )
    expect(lista).toHaveLength(7)
    expect(lista[0].produto).toBe('Empada de frango')
  })
})

describe('lista de vendas e fiado na imagem', () => {
  const lista = [
    { venda_id: 'a', hora: '2026-10-29T16:00:00Z', cliente: 'Ana', produto: 'Pudim', quantidade: 1, valor: 800, pagamento: 'fiado' as const },
    { venda_id: 'b', hora: '2026-10-29T16:10:00Z', cliente: 'Caio', produto: 'Pudim', quantidade: 2, valor: 1600, pagamento: 'fiado' as const },
    { venda_id: 'c', hora: '2026-10-29T16:20:00Z', cliente: null, produto: 'Pudim', quantidade: 1, valor: 800, pagamento: 'pix' as const },
  ]

  it('snapshot guarda a lista e a imagem lê em centavos', () => {
    const s = criarSnapshot('2026-10-29', calcularResumo(itens, vendas), null, 'x', lista)
    expect(s.vendas_lista![1].valor).toBe(16)
    const img = imagemDoSnapshot(JSON.parse(JSON.stringify(s)))
    expect(img.lista[1].valor).toBe(1600)
    expect(img.lista[0].cliente).toBe('Ana')
  })

  it('separa fiado pago e a receber pela situação atual', () => {
    expect(totaisFiado(lista, { a: { pagamento: 'pix', data: '2026-11-02' } })).toEqual({ pago: 800, aReceber: 1600 })
    expect(totaisFiado(lista, {})).toEqual({ pago: 0, aReceber: 2400 })
  })
})

describe('lista da imagem separada por produto', () => {
  const v = (id: string, produto: string, hora: string, valor = 600) => ({
    venda_id: id,
    hora: `2026-10-29T${hora}:00Z`,
    cliente: id,
    produto,
    quantidade: 1,
    valor,
    pagamento: 'pix' as const,
  })
  const d = {
    itens: [{ nome: 'Empada de frango' }, { nome: 'Pudim' }],
    lista: [v('a', 'Pudim', '17:00', 500), v('b', 'Empada de frango', '18:00'), v('c', 'Empada de frango', '16:00'), v('d', 'Pudim', '15:00', 500)],
  }

  it('agrupa na ordem dos produtos e ordena pela hora', () => {
    const g = agruparPorProduto(d)
    expect(g.map((x) => x.produto)).toEqual(['Empada de frango', 'Pudim'])
    expect(g[0].vendas.map((x) => x.venda_id)).toEqual(['c', 'b'])
    expect(g[1]).toMatchObject({ quantidade: 2, valor: 1000 })
  })

  it('cabe tudo numa página quando há espaço', () => {
    const p = paginarGrupos(agruparPorProduto(d), { primeira: 20, demais: 30 })
    expect(p).toHaveLength(1)
    expect(p[0].map((b) => b.vendas.length)).toEqual([2, 2])
  })

  it('quebra um produto em duas páginas e marca a continuação', () => {
    const muitos = { itens: d.itens, lista: Array.from({ length: 25 }, (_, i) => v(`x${i}`, 'Pudim', `1${String(i).padStart(1, '0')}:00`.slice(0, 5))) }
    const p = paginarGrupos(agruparPorProduto(muitos), { primeira: 10, demais: 30 })
    expect(p).toHaveLength(2)
    expect(p[0][0].continuacao).toBe(false)
    expect(p[1][0].continuacao).toBe(true)
    expect(p.flat().reduce((s, b) => s + b.vendas.length, 0)).toBe(25)
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
    const s = criarSnapshotLancamento('2026-10-25', linhas, { pix: 12000, dinheiro: 6000, cartao: 1600, fiado: 0 }, 8000, 'x')
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
    expect(validarLancamento(linhas, { pix: 12000, dinheiro: 6000, cartao: 1600, fiado: 0 })).toBeNull()
    expect(validarLancamento(linhas, { pix: 12000, dinheiro: 0, cartao: 0, fiado: 7600 })).toBeNull()
    expect(validarLancamento(linhas, { pix: 12000, dinheiro: 0, cartao: 0, fiado: 0 })).toMatch(/diferente/)
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

  it('lê snapshots antigos sem fiado e sem lista de vendas', () => {
    const antigo = JSON.parse(JSON.stringify(criarSnapshot('2026-10-29', r, null, 'x')))
    delete antigo.pagamentos.fiado
    delete antigo.vendas_lista
    const img = imagemDoSnapshot(antigo)
    expect(img.pagamentos.fiado).toBe(0)
    expect(img.lista).toEqual([])
  })

  it('sem gasto (N/A) grava null', () => {
    const s = criarSnapshot('2026-10-29', r, null, '2026-10-29T23:00:00Z')
    expect(s.totais.gasto).toBeNull()
    expect(imagemDoSnapshot(JSON.parse(JSON.stringify(s))).gasto).toBeNull()
    expect(s.totais.lucro).toBe(370)
  })
})
