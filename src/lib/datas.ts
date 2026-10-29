export const FUSO = 'America/Belem'

/** Data de hoje (AAAA-MM-DD) no fuso de Belém, nunca em UTC. */
export function hojeBelem(agora: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

// Datas AAAA-MM-DD são datas de calendário: formatamos ao meio-dia UTC para não mudar de dia
function meioDia(data: string): Date {
  return new Date(`${data}T12:00:00Z`)
}

/** "quinta-feira" */
export function diaDaSemana(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(meioDia(data))
}

/** "29/10/2026" */
export function dataCurta(data: string): string {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

/** "29 de outubro" */
export function diaMes(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(meioDia(data))
}

/** "quinta-feira, 29 de outubro de 2026" */
export function dataLonga(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(meioDia(data))
}

/** Hora local de Belém de um timestamp: "13:42" */
export function hora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO }).format(new Date(iso))
}
