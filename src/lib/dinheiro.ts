// Dinheiro no código é sempre centavos inteiros. No banco é numeric(10,2).

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 37000 -> "R$ 370,00"; -200 -> "−R$ 2,00" */
export function reais(centavos: number): string {
  const sinal = centavos < 0 ? '−' : ''
  return `${sinal}R$ ${fmt.format(Math.abs(centavos) / 100)}`
}

/** 1100 -> "11,00" (para preencher campos) */
export function numeroBR(centavos: number): string {
  return fmt.format(centavos / 100)
}

/** Valor vindo do banco (number ou string numeric) -> centavos */
export function deBanco(valor: number | string | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') return 0
  return Math.round(Number(valor) * 100)
}

/** Centavos -> string aceita pelo numeric do Postgres */
export function paraBanco(centavos: number): string {
  return (centavos / 100).toFixed(2)
}

/**
 * Lê o que o usuário digitou ("11", "11,5", "1.234,50", "R$ 6,00", "6.5").
 * Retorna centavos ou null se não for um valor válido.
 */
export function lerReais(texto: string): number | null {
  let s = texto.replace(/R\$|\s/g, '')
  if (s === '') return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null
  return Math.round(Number(s) * 100)
}

export function porcentagem(fracao: number | null, casas = 1): string {
  if (fracao === null || !Number.isFinite(fracao)) return '—'
  return `${(fracao * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}
