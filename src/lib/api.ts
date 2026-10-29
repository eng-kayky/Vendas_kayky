import { supabase } from './supabase'
import { deBanco, paraBanco } from './dinheiro'
import { hojeBelem } from './datas'
import { calcularResumo, criarSnapshot, type Pagamento, type Snapshot } from './resumo'

export interface Dia {
  id: string
  data: string
  status: 'aberto' | 'fechado'
  fechado_em: string | null
  snapshot: Snapshot | null
}

export interface ItemDia {
  id: string
  produto_id: string
  nome: string
  produzido: number
  preco: number // centavos
  custo: number // centavos
}

export interface Venda {
  id: string
  item_dia_id: string
  quantidade: number
  valor_cobrado: number // centavos
  pagamento: Pagamento
  cliente: string | null
  criado_em: string
}

export interface DiaCompleto {
  dia: Dia
  itens: ItemDia[]
  vendas: Venda[]
}

export interface ProdutoAbrir {
  produto_id: string
  nome: string
  produzido: number
  preco: number
  custo: number
}

/** Mensagem legível para erros do Supabase/Postgres. */
export function mensagemErro(e: unknown): string {
  const err = e as { message?: string; code?: string }
  if (!navigator.onLine) return 'Sem conexão com a internet. Nada foi salvo.'
  if (err?.code === '23505') return 'Já existe um registro igual (o dia pode já ter sido aberto).'
  if (err?.message?.includes('cliente_obrigatorio_no_pix')) return 'No Pix, o nome do cliente é obrigatório.'
  if (err?.message?.includes('Failed to fetch')) return 'Não foi possível falar com o servidor. Nada foi salvo.'
  return err?.message ?? 'Erro inesperado.'
}

type Resposta = { data: unknown; error: unknown }

function ok<R extends Resposta>(r: R): NonNullable<R['data']> {
  if (r.error) throw r.error
  if (r.data === null) throw new Error('Resposta vazia do servidor.')
  return r.data as NonNullable<R['data']>
}

/** Para consultas .maybeSingle(): null quando não há linha. */
function okTalvez<R extends Resposta>(r: R): R['data'] {
  if (r.error) throw r.error
  return r.data
}

type Linha = Record<string, unknown>

const paraDia = (d: Linha): Dia => ({
  id: d.id as string,
  data: d.data as string,
  status: d.status as Dia['status'],
  fechado_em: (d.fechado_em as string) ?? null,
  snapshot: (d.snapshot as Snapshot) ?? null,
})

const paraItem = (i: Linha): ItemDia => ({
  id: i.id as string,
  produto_id: i.produto_id as string,
  nome: i.nome as string,
  produzido: i.produzido as number,
  preco: deBanco(i.preco as string),
  custo: deBanco(i.custo as string),
})

const paraVenda = (v: Linha): Venda => ({
  id: v.id as string,
  item_dia_id: v.item_dia_id as string,
  quantidade: v.quantidade as number,
  valor_cobrado: deBanco(v.valor_cobrado as string),
  pagamento: v.pagamento as Pagamento,
  cliente: (v.cliente as string) ?? null,
  criado_em: v.criado_em as string,
})

async function completar(dia: Dia): Promise<DiaCompleto> {
  const itens = ok(
    await supabase.from('itens_dia').select('id, produto_id, nome, produzido, preco, custo').eq('dia_id', dia.id).order('nome'),
  ).map(paraItem)
  const ids = itens.map((i) => i.id)
  const vendas = ids.length
    ? ok(
        await supabase
          .from('vendas')
          .select('id, item_dia_id, quantidade, valor_cobrado, pagamento, cliente, criado_em')
          .in('item_dia_id', ids)
          .order('criado_em', { ascending: false }),
      ).map(paraVenda)
    : []
  return { dia, itens, vendas }
}

const COLUNAS_DIA = 'id, data, status, fechado_em, snapshot'

export async function carregarDiaPorData(data: string): Promise<DiaCompleto | null> {
  const d = okTalvez(await supabase.from('dias').select(COLUNAS_DIA).eq('data', data).maybeSingle())
  return d ? completar(paraDia(d)) : null
}

export async function carregarDiaPorId(id: string): Promise<DiaCompleto | null> {
  const d = okTalvez(await supabase.from('dias').select(COLUNAS_DIA).eq('id', id).maybeSingle())
  return d ? completar(paraDia(d)) : null
}

export async function carregarHoje() {
  return carregarDiaPorData(hojeBelem())
}

/** Dia de antes de hoje que ficou aberto (esqueceram de finalizar). */
export async function diaAnteriorAberto(): Promise<Dia | null> {
  const d = ok(
    await supabase.from('dias').select(COLUNAS_DIA).eq('status', 'aberto').lt('data', hojeBelem()).order('data', { ascending: false }).limit(1),
  )
  return d.length ? paraDia(d[0]) : null
}

/** Produtos ativos com os valores do último dia em que foram usados. */
export async function produtosParaAbrir(): Promise<ProdutoAbrir[]> {
  const produtos = ok(await supabase.from('produtos').select('id, nome, preco_padrao, custo_padrao').eq('ativo', true).order('criado_em'))
  const ultimos = ok(await supabase.from('ultimos_valores').select('produto_id, produzido, preco, custo'))
  const mapa = new Map(ultimos.map((u) => [u.produto_id as string, u]))
  return produtos.map((p) => {
    const u = mapa.get(p.id)
    return {
      produto_id: p.id,
      nome: p.nome,
      produzido: (u?.produzido as number) ?? 0,
      preco: deBanco(u ? (u.preco as string) : p.preco_padrao),
      custo: deBanco(u ? (u.custo as string) : p.custo_padrao),
    }
  })
}

export async function criarProduto(nome: string, preco: number, custo: number): Promise<string> {
  const p = ok(
    await supabase
      .from('produtos')
      .insert({ nome: nome.trim(), preco_padrao: paraBanco(preco), custo_padrao: paraBanco(custo) })
      .select('id')
      .single(),
  )
  return p.id
}

export async function abrirDia(itens: ProdutoAbrir[]): Promise<string> {
  const payload = itens.map((i) => ({
    produto_id: i.produto_id,
    produzido: i.produzido,
    preco: paraBanco(i.preco),
    custo: paraBanco(i.custo),
  }))
  return ok(await supabase.rpc('abrir_dia', { p_itens: payload })) as string
}

export async function registrarVenda(v: {
  item_dia_id: string
  quantidade: number
  valor_cobrado: number
  pagamento: Pagamento
  cliente: string
}) {
  const cliente = v.cliente.trim()
  ok(
    await supabase.from('vendas').insert({
      item_dia_id: v.item_dia_id,
      quantidade: v.quantidade,
      valor_cobrado: paraBanco(v.valor_cobrado),
      pagamento: v.pagamento,
      cliente: cliente || null,
    }),
  )
}

export async function desfazerVenda(id: string) {
  const apagadas = ok(await supabase.from('vendas').delete().eq('id', id).select('id'))
  if (!apagadas.length) throw new Error('A venda não foi encontrada (talvez já tenha sido desfeita).')
}

/** Nomes de clientes já usados, mais recentes primeiro. */
export async function clientesRecentes(limite = 8): Promise<string[]> {
  const linhas = ok(
    await supabase.from('vendas').select('cliente, criado_em').not('cliente', 'is', null).order('criado_em', { ascending: false }).limit(300),
  )
  const vistos = new Map<string, string>()
  for (const l of linhas) {
    const nome = (l.cliente as string).trim()
    const chave = nome.toLocaleLowerCase('pt-BR')
    if (nome && !vistos.has(chave)) vistos.set(chave, nome)
    if (vistos.size >= limite) break
  }
  return [...vistos.values()]
}

/** Recarrega o dia do banco, calcula o resumo e grava o snapshot fechando o dia. */
export async function finalizarDia(diaId: string): Promise<Snapshot> {
  const atual = await carregarDiaPorId(diaId)
  if (!atual) throw new Error('Dia não encontrado.')
  if (atual.dia.status === 'fechado') throw new Error('Este dia já está fechado.')
  const resumo = calcularResumo(atual.itens, atual.vendas)
  const snapshot = criarSnapshot(atual.dia.data, resumo, new Date().toISOString())
  const r = ok(
    await supabase.from('dias').update({ status: 'fechado', snapshot }).eq('id', diaId).eq('status', 'aberto').select('fechado_em'),
  )
  if (!r.length) throw new Error('Não foi possível fechar o dia (ele pode ter sido fechado por outra pessoa).')
  snapshot.fechado_em = r[0].fechado_em as string
  return snapshot
}

export async function reabrirDia(diaId: string) {
  ok(await supabase.from('dias').update({ status: 'aberto' }).eq('id', diaId))
}

export interface DiaHistorico {
  id: string
  data: string
  status: Dia['status']
  liquido: number | null
  lucro: number | null
}

export async function listarHistorico(): Promise<DiaHistorico[]> {
  const dias = ok(await supabase.from('dias').select('id, data, status, snapshot').order('data', { ascending: false }).limit(120))
  return dias.map((d) => {
    const s = d.snapshot as Snapshot | null
    return {
      id: d.id,
      data: d.data,
      status: d.status,
      liquido: s ? Math.round(s.totais.liquido * 100) : null,
      lucro: s ? Math.round(s.totais.lucro * 100) : null,
    }
  })
}
