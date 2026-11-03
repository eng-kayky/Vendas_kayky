import { describe, expect, it } from 'vitest'
import { agregarRelatorio, deslocar, nomePeriodo, periodoDe } from './relatorio'
import { calcularResumo, criarSnapshot, criarSnapshotLancamento, listarVendasDoDia } from './resumo'

describe('períodos', () => {
  it('semana de segunda a domingo', () => {
    // 29/10/2026 é quinta-feira
    expect(periodoDe('semana', '2026-10-29')).toEqual({ tipo: 'semana', inicio: '2026-10-26', fim: '2026-11-01' })
    expect(periodoDe('semana', '2026-10-26').inicio).toBe('2026-10-26')
    expect(periodoDe('semana', '2026-11-01').inicio).toBe('2026-10-26')
  })

  it('mês inteiro, inclusive fevereiro', () => {
    expect(periodoDe('mes', '2026-10-29')).toEqual({ tipo: 'mes', inicio: '2026-10-01', fim: '2026-10-31' })
    expect(periodoDe('mes', '2028-02-10').fim).toBe('2028-02-29')
  })

  it('navega para trás e para frente, virando o ano', () => {
    expect(deslocar(periodoDe('semana', '2026-10-29'), -1).inicio).toBe('2026-10-19')
    expect(deslocar(periodoDe('mes', '2026-12-15'), 1).inicio).toBe('2027-01-01')
    expect(deslocar(periodoDe('mes', '2026-01-15'), -1).inicio).toBe('2025-12-01')
  })

  it('nomes', () => {
    expect(nomePeriodo(periodoDe('semana', '2026-10-29'))).toBe('26/10 a 01/11')
    expect(nomePeriodo(periodoDe('mes', '2026-10-29'))).toBe('Outubro de 2026')
  })
})

describe('agregarRelatorio', () => {
  const itens = [
    { id: 'f', nome: 'Empada de frango', produzido: 10, preco: 600 },
    { id: 'u', nome: 'Pudim', produzido: 5, preco: 800 },
  ]
  const vendas = [
    { id: 'a', item_dia_id: 'f', quantidade: 2, valor_cobrado: 1200, pagamento: 'pix' as const, cliente: 'Ana', criado_em: '2026-10-29T15:00:00Z' },
    { id: 'b', item_dia_id: 'u', quantidade: 1, valor_cobrado: 800, pagamento: 'fiado' as const, cliente: 'ana', criado_em: '2026-10-29T16:00:00Z' },
    { id: 'c', item_dia_id: 'f', quantidade: 3, valor_cobrado: 1800, pagamento: 'dinheiro' as const, cliente: null, criado_em: '2026-10-29T17:00:00Z' },
  ]
  const dia1 = criarSnapshot('2026-10-29', calcularResumo(itens, vendas), 1000, 'x', listarVendasDoDia(itens, vendas))
  const dia2 = criarSnapshotLancamento('2026-10-27', [{ nome: 'Pudim', produzido: 4, vendido: 4, faturado: 3200 }], null, null, 'x')

  it('soma os dias e separa recebido de fiado', () => {
    const r = agregarRelatorio([dia1, dia2])
    expect(r.dias).toBe(2)
    expect(r.faturamento).toBe(3800 + 3200)
    expect(r.recebido).toBe(3000)
    expect(r.pagamentos.fiado).toBe(800)
    expect(r.fiadoAReceber).toBe(800)
    expect(r.gasto).toBe(1000)
    expect(r.diasSemGasto).toBe(1)
    expect(r.lucro).toBe(2800 + 3200)
    expect(r.unidades).toBe(10)
  })

  it('fiado pago depois sai do a receber', () => {
    expect(agregarRelatorio([dia1], { b: { pagamento: 'pix', data: '2026-11-02' } }).fiadoAReceber).toBe(0)
  })

  it('produtos, clientes, melhor dia e ticket médio', () => {
    const r = agregarRelatorio([dia1, dia2])
    expect(r.produtos[0]).toEqual({ nome: 'Pudim', vendido: 5, sobra: 4, faturado: 4000 })
    expect(r.clientes).toEqual([{ nome: 'Ana', compras: 2, total: 2000 }]) // Ana e ana juntas
    expect(r.melhorDia).toEqual({ data: '2026-10-29', faturamento: 3800 })
    expect(r.ticketMedio).toBe(Math.round(3800 / 3)) // lançamento por resumo não entra no ticket
    expect(r.porDia.map((d) => d.data)).toEqual(['2026-10-27', '2026-10-29'])
  })

  it('período vazio', () => {
    const r = agregarRelatorio([])
    expect(r.faturamento).toBe(0)
    expect(r.margem).toBeNull()
    expect(r.melhorDia).toBeNull()
    expect(r.ticketMedio).toBeNull()
  })
})
