import { describe, expect, it } from 'vitest'
import { dataCurta, dataLonga, diaDaSemana, hojeBelem, hora } from './datas'
import { lerReais, porcentagem, reais } from './dinheiro'

describe('datas no fuso de Belém', () => {
  it('venda às 22h em Belém ainda é do mesmo dia', () => {
    // 22:30 de 29/10 em Belém = 01:30 de 30/10 em UTC
    expect(hojeBelem(new Date('2026-10-30T01:30:00Z'))).toBe('2026-10-29')
    expect(hojeBelem(new Date('2026-10-30T03:00:00Z'))).toBe('2026-10-30')
  })

  it('hora local', () => {
    expect(hora('2026-10-29T16:42:00Z')).toBe('13:42')
  })

  it('formata a data', () => {
    expect(diaDaSemana('2026-10-29')).toBe('quinta-feira')
    expect(dataCurta('2026-10-29')).toBe('29/10/2026')
    expect(dataLonga('2026-10-29')).toBe('quinta-feira, 29 de outubro de 2026')
  })
})

describe('dinheiro', () => {
  it('formata em pt-BR', () => {
    expect(reais(37000)).toBe('R$ 370,00')
    expect(reais(-200)).toBe('−R$ 2,00')
    expect(reais(123456)).toBe('R$ 1.234,56')
  })

  it('lê o que o usuário digita', () => {
    expect(lerReais('11,00')).toBe(1100)
    expect(lerReais('11')).toBe(1100)
    expect(lerReais('6,5')).toBe(650)
    expect(lerReais('6.5')).toBe(650)
    expect(lerReais('1.234,56')).toBe(123456)
    expect(lerReais('R$ 8,00')).toBe(800)
    expect(lerReais('')).toBeNull()
    expect(lerReais('abc')).toBeNull()
    expect(lerReais('-3')).toBeNull()
  })

  it('porcentagem', () => {
    expect(porcentagem(0.33783)).toBe('33,8%')
    expect(porcentagem(null)).toBe('—')
  })
})
