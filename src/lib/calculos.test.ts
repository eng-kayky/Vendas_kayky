import { describe, expect, it } from 'vitest'
import {
  agregarRelatorio,
  deslocar,
  disponivelNoCarrinho,
  estoqueBaixo,
  nomePeriodo,
  paginarGrupos,
  periodoDe,
  resumirDia,
  valoresPorItem,
  vendasPorProduto,
} from './calculos'
import type { DiaCompleto, Pedido } from './tipos'

const itens = [
  { id: 'f', produtoId: 'pf', nome: 'Empada de frango', unidade: 'un', produzido: 20, preco: 600 },
  { id: 'u', produtoId: 'pu', nome: 'Pudim', unidade: 'fatia', produzido: null, preco: 500 },
]

let n = 0
function pedido(p: Omit<Partial<Pedido>, 'itens'> & { itens: [string, number][] }): Pedido {
  const linhas = p.itens.map(([item, q]) => {
    const preco = itens.find((i) => i.id === item)!.preco
    return { id: `i${n++}`, itemDiaId: item, quantidade: q, precoUnit: preco, subtotal: q * preco }
  })
  const sub = linhas.reduce((s, l) => s + l.subtotal, 0)
  const desconto = p.desconto ?? 0
  return {
    id: p.id ?? `p${n++}`,
    diaId: 'd',
    clienteId: null,
    cliente: p.cliente ?? null,
    status: p.status ?? 'concluido',
    pagamento: p.status === 'reservado' ? null : (p.pagamento ?? 'pix'),
    desconto,
    total: sub - desconto,
    observacao: null,
    fiadoPagoEm: p.fiadoPagoEm ?? null,
    fiadoPagoCom: p.fiadoPagoCom ?? null,
    criadoEm: p.criadoEm ?? '2026-11-04T15:00:00Z',
    itens: linhas,
  }
}

const dia = (pedidos: Pedido[], gasto: number | null = 1000): DiaCompleto => ({
  dia: { id: 'd', data: '2026-11-04', status: 'aberto', gasto, semGasto: gasto === null, fechadoEm: null },
  itens,
  pedidos,
})

describe('desconto repartido entre os itens', () => {
  it('a soma bate com o total cobrado', () => {
    const p = pedido({ itens: [['f', 2], ['u', 1]], desconto: 100 }) // 1700 − 100
    const v = valoresPorItem(p)
    expect(v.reduce((a, b) => a + b, 0)).toBe(1600)
    expect(v).toEqual([1129, 471])
  })
  it('acréscimo (desconto negativo)', () => {
    expect(valoresPorItem(pedido({ itens: [['f', 1]], desconto: -100 }))).toEqual([700])
  })
})

describe('resumo do dia', () => {
  const pedidos = [
    pedido({ itens: [['f', 2], ['u', 1]], pagamento: 'pix', cliente: 'Ana', desconto: 100 }), // 1600
    pedido({ itens: [['f', 1]], pagamento: 'dinheiro' }), // 600
    pedido({ itens: [['u', 2]], pagamento: 'fiado', cliente: 'Caio' }), // 1000 a receber
    pedido({ itens: [['f', 1]], pagamento: 'fiado', cliente: 'Bia', fiadoPagoEm: '2026-11-05', fiadoPagoCom: 'pix' }), // 600 pago
    pedido({ itens: [['f', 3]], status: 'reservado', cliente: 'Davi' }), // reserva 1800
  ]
  const r = resumirDia(dia(pedidos))

  it('faturamento, recebido e a receber', () => {
    expect(r.vendas).toBe(4)
    expect(r.faturamento).toBe(3800)
    expect(r.bruto).toBe(3900)
    expect(r.descontos).toBe(100)
    expect(r.aReceber).toBe(1000)
    expect(r.recebido).toBe(2800) // inclui o fiado já pago
    expect(r.fiadoPago).toBe(600)
    expect(r.fiadoPagoPorForma.pix).toBe(600)
    expect(r.porForma).toMatchObject({ pix: 1600, dinheiro: 600, fiado: 1600 })
  })

  it('reserva tira do estoque mas não é venda', () => {
    expect(r.reservas).toBe(1)
    expect(r.reservadoValor).toBe(1800)
    const frango = r.itens.find((i) => i.id === 'f')!
    expect(frango.vendido).toBe(4)
    expect(frango.reservado).toBe(3)
    expect(frango.restante).toBe(13) // 20 − 4 − 3
  })

  it('produto sem controle de estoque', () => {
    const pudim = r.itens.find((i) => i.id === 'u')!
    expect(pudim.restante).toBeNull()
    expect(pudim.vendido).toBe(3)
    expect(r.disponivel).toBe(13)
  })

  it('lucro e margem com o gasto do dia', () => {
    expect(r.lucro).toBe(2800)
    expect(r.margem).toBeCloseTo(2800 / 3800)
    expect(resumirDia(dia(pedidos, null)).lucro).toBe(3800)
    expect(resumirDia(dia([])).margem).toBeNull()
  })
})

describe('vendas por produto', () => {
  it('pedido com 2 produtos aparece em cada grupo, com o valor repartido', () => {
    const g = vendasPorProduto(dia([pedido({ itens: [['f', 2], ['u', 1]], desconto: 100, cliente: 'Ana' })]))
    expect(g.map((x) => x.produto)).toEqual(['Empada de frango', 'Pudim'])
    expect(g[0].linhas[0]).toMatchObject({ cliente: 'Ana', quantidade: 2, valor: 1129 })
    expect(g[1].valor).toBe(471)
  })
  it('reserva não entra; ordena pela hora', () => {
    const g = vendasPorProduto(
      dia([
        pedido({ itens: [['f', 1]], criadoEm: '2026-11-04T18:00:00Z', cliente: 'B' }),
        pedido({ itens: [['f', 1]], criadoEm: '2026-11-04T14:00:00Z', cliente: 'A' }),
        pedido({ itens: [['f', 1]], status: 'reservado', cliente: 'R' }),
      ]),
    )
    expect(g[0].linhas.map((l) => l.cliente)).toEqual(['A', 'B'])
  })
  it('pagina e marca a continuação', () => {
    const muitos = dia(Array.from({ length: 30 }, () => pedido({ itens: [['f', 1]] })))
    const p = paginarGrupos(vendasPorProduto(muitos), { primeira: 10, demais: 30 })
    expect(p).toHaveLength(2)
    expect(p[1][0].continuacao).toBe(true)
    expect(p.flat().reduce((s, b) => s + b.linhas.length, 0)).toBe(30)
  })
})

describe('carrinho e estoque', () => {
  const linha = resumirDia(dia([pedido({ itens: [['f', 5]] })])).itens[0]
  it('desconta o que já está no carrinho e devolve a própria venda ao editar', () => {
    expect(disponivelNoCarrinho(linha, [{ itemDiaId: 'f', quantidade: 2, precoUnit: 600 }])).toBe(13)
    expect(disponivelNoCarrinho(linha, [], 5)).toBe(20)
  })
  it('estoque baixo só com controle', () => {
    expect(estoqueBaixo(4, 20)).toBe(true)
    expect(estoqueBaixo(5, 20)).toBe(false)
    expect(estoqueBaixo(null, null)).toBe(false)
  })
})

describe('períodos', () => {
  it('semana de segunda a domingo e mês inteiro', () => {
    expect(periodoDe('semana', '2026-10-29')).toEqual({ tipo: 'semana', inicio: '2026-10-26', fim: '2026-11-01' })
    expect(periodoDe('mes', '2028-02-10').fim).toBe('2028-02-29')
  })
  it('navega virando o ano', () => {
    expect(deslocar(periodoDe('mes', '2026-12-15'), 1).inicio).toBe('2027-01-01')
    expect(deslocar(periodoDe('semana', '2026-10-29'), -1).inicio).toBe('2026-10-19')
  })
  it('nomes', () => {
    expect(nomePeriodo(periodoDe('semana', '2026-10-29'))).toBe('26/10 a 01/11')
    expect(nomePeriodo(periodoDe('mes', '2026-10-29'))).toBe('Outubro de 2026')
  })
})

describe('relatório', () => {
  it('soma os dias, junta clientes iguais e acha o melhor dia', () => {
    const d1 = dia([pedido({ itens: [['f', 2]], cliente: 'Ana' }), pedido({ itens: [['u', 1]], pagamento: 'fiado', cliente: 'ana' })], 500)
    const d2 = { ...dia([pedido({ itens: [['f', 1]] })], null), dia: { ...dia([]).dia, id: 'd2', data: '2026-11-03', gasto: null, semGasto: true } }
    const r = agregarRelatorio([d1, d2])
    expect(r.dias).toBe(2)
    expect(r.faturamento).toBe(1700 + 600)
    expect(r.aReceber).toBe(500)
    expect(r.gasto).toBe(500)
    expect(r.diasSemGasto).toBe(1)
    expect(r.lucro).toBe(1200 + 600)
    expect(r.clientes).toEqual([{ nome: 'Ana', compras: 2, total: 1700 }])
    expect(r.melhorDia).toEqual({ data: '2026-11-04', faturamento: 1700 })
    expect(r.porDia.map((d) => d.data)).toEqual(['2026-11-03', '2026-11-04'])
    expect(r.produtos[0]).toMatchObject({ nome: 'Empada de frango', vendido: 3 })
  })
})
