// Acesso ao Supabase. Tudo que sai daqui já está em centavos e com os nomes do app (lib/tipos.ts).
import { supabase } from './supabase'
import { deBanco, paraBanco } from './dinheiro'
import { hojeBelem } from './datas'
import type { Cliente, Dia, DiaCompleto, FormaRecebimento, ItemDia, Pagamento, Pedido, Produto, StatusPedido } from './tipos'

// ---------------------------------------------------------------- erros

/** Mensagem legível para erros do Supabase/Postgres. */
export function mensagemErro(e: unknown): string {
  const err = e as { message?: string; code?: string; details?: string }
  const msg = err?.message ?? ''
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Sem conexão com a internet. Nada foi salvo.'
  if (msg.includes('Failed to fetch')) return 'Não foi possível falar com o servidor. Nada foi salvo.'
  if (err?.code === '42P01' || err?.code === 'PGRST205' || err?.code === 'PGRST202' || (err?.code === '42703' && msg.includes('pedidos')))
    return 'O banco ainda não foi atualizado. Rode o arquivo 0004_reestruturacao.sql no SQL Editor do Supabase.'
  if (err?.code === '23505') {
    if (msg.includes('produtos')) return 'Já existe um produto com esse nome.'
    if (msg.includes('clientes')) return 'Já existe um cliente com esse nome.'
    if (msg.includes('dias')) return 'Já existe um dia com essa data. Abra-o pelo Histórico.'
    return 'Registro repetido.'
  }
  if (msg.includes('cliente_no_pix_fiado_reserva')) return 'Informe o nome do cliente (obrigatório no Pix, no fiado e na reserva).'
  if (msg.includes('pagamento_na_venda')) return 'Escolha a forma de pagamento.'
  if (err?.code === 'P0001') return msg // mensagens das regras do banco já vêm em português
  return msg || 'Erro inesperado.'
}

type Resposta = { data: unknown; error: unknown }
function ok<R extends Resposta>(r: R): NonNullable<R['data']> {
  if (r.error) throw r.error
  if (r.data === null) throw new Error('Resposta vazia do servidor.')
  return r.data as NonNullable<R['data']>
}
function okTalvez<R extends Resposta>(r: R): R['data'] {
  if (r.error) throw r.error
  return r.data
}

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------------------------------------------------------------- conversões

const paraDia = (d: Linha): Dia => ({
  id: d.id,
  data: d.data,
  status: d.status,
  gasto: d.gasto === null || d.gasto === undefined ? null : deBanco(d.gasto),
  semGasto: Boolean(d.sem_gasto),
  fechadoEm: d.fechado_em ?? null,
})

const paraItem = (i: Linha): ItemDia => ({
  id: i.id,
  produtoId: i.produto_id,
  nome: i.nome,
  unidade: i.produtos?.unidade ?? 'un',
  produzido: i.produzido ?? null,
  preco: deBanco(i.preco),
})

const paraPedido = (p: Linha): Pedido => ({
  id: p.id,
  diaId: p.dia_id,
  clienteId: p.cliente_id ?? null,
  cliente: p.clientes?.nome ?? null,
  status: p.status,
  pagamento: p.pagamento ?? null,
  desconto: deBanco(p.desconto),
  total: deBanco(p.total),
  observacao: p.observacao ?? null,
  fiadoPagoEm: p.fiado_pago_em ?? null,
  fiadoPagoCom: p.fiado_pago_com ?? null,
  criadoEm: p.criado_em,
  itens: (p.pedido_itens ?? []).map((i: Linha) => ({
    id: i.id,
    itemDiaId: i.item_dia_id,
    quantidade: i.quantidade,
    precoUnit: deBanco(i.preco_unit),
    subtotal: deBanco(i.subtotal),
  })),
})

const paraProduto = (p: Linha): Produto => ({
  id: p.id,
  nome: p.nome,
  preco: deBanco(p.preco_padrao),
  unidade: p.unidade ?? 'un',
  categoria: p.categoria ?? null,
  ativo: p.ativo,
})

// ---------------------------------------------------------------- dias

const SELECT_DIA = `id, data, status, gasto, sem_gasto, fechado_em,
  itens_dia(id, produto_id, nome, produzido, preco, produtos(unidade)),
  pedidos(*, clientes(nome), pedido_itens(id, item_dia_id, quantidade, preco_unit, subtotal))`

function paraDiaCompleto(d: Linha): DiaCompleto {
  return {
    dia: paraDia(d),
    itens: (d.itens_dia ?? []).map(paraItem).sort((a: ItemDia, b: ItemDia) => a.nome.localeCompare(b.nome, 'pt-BR')),
    pedidos: (d.pedidos ?? []).map(paraPedido).sort((a: Pedido, b: Pedido) => b.criadoEm.localeCompare(a.criadoEm)),
  }
}

export async function carregarDia(id: string): Promise<DiaCompleto | null> {
  const d = okTalvez(await supabase.from('dias').select(SELECT_DIA).eq('id', id).maybeSingle())
  return d ? paraDiaCompleto(d) : null
}

export async function carregarDiaPorData(data: string): Promise<DiaCompleto | null> {
  const d = okTalvez(await supabase.from('dias').select(SELECT_DIA).eq('data', data).maybeSingle())
  return d ? paraDiaCompleto(d) : null
}

export const carregarHoje = () => carregarDiaPorData(hojeBelem())

/** Dias de antes de hoje que ficaram abertos (esqueceram de fechar). */
export async function diasAbertosAnteriores(): Promise<Dia[]> {
  const d = ok(await supabase.from('dias').select('id, data, status, gasto, sem_gasto, fechado_em').eq('status', 'aberto').lt('data', hojeBelem()).order('data'))
  return d.map(paraDia)
}

/** Dias completos (fechados) de um período, para o relatório. */
export async function diasDoPeriodo(inicio: string, fim: string) {
  const d = ok(await supabase.from('dias').select(SELECT_DIA).gte('data', inicio).lte('data', fim).order('data'))
  const todos = d.map(paraDiaCompleto)
  return { fechados: todos.filter((x) => x.dia.status === 'fechado'), abertos: todos.filter((x) => x.dia.status === 'aberto').map((x) => x.dia) }
}

export interface DiaHistorico {
  dia: Dia
  vendas: number
  faturamento: number
  aReceber: number
  lucro: number | null // só para dia fechado
}

export async function listarHistorico(limite = 180): Promise<DiaHistorico[]> {
  const dias = ok(
    await supabase
      .from('dias')
      .select('id, data, status, gasto, sem_gasto, fechado_em, pedidos(total, status, pagamento, fiado_pago_em)')
      .order('data', { ascending: false })
      .limit(limite),
  )
  return dias.map((d) => {
    const dia = paraDia(d)
    const concluidos = (d.pedidos as Linha[]).filter((p) => p.status === 'concluido')
    const faturamento = concluidos.reduce((s, p) => s + deBanco(p.total), 0)
    const aReceber = concluidos.filter((p) => p.pagamento === 'fiado' && !p.fiado_pago_em).reduce((s, p) => s + deBanco(p.total), 0)
    return {
      dia,
      vendas: concluidos.length,
      faturamento,
      aReceber,
      lucro: dia.status === 'fechado' ? faturamento - (dia.gasto ?? 0) : null,
    }
  })
}

/** Abre um dia (hoje ou anterior) com os produtos escolhidos. */
export async function abrirDia(data: string, itens: { produtoId: string; produzido: number | null; preco: number }[]): Promise<string> {
  const payload = itens.map((i) => ({ produto_id: i.produtoId, produzido: i.produzido ?? '', preco: paraBanco(i.preco) }))
  return ok(await supabase.rpc('abrir_dia_em', { p_data: data, p_itens: payload })) as string
}

/** Fecha o dia com o gasto com material (centavos) ou null = "não teve gasto". */
export async function fecharDia(diaId: string, gasto: number | null) {
  const r = ok(
    await supabase
      .from('dias')
      .update({ status: 'fechado', gasto: gasto === null ? null : paraBanco(gasto), sem_gasto: gasto === null })
      .eq('id', diaId)
      .eq('status', 'aberto')
      .select('id'),
  )
  if (!r.length) throw new Error('Não foi possível fechar o dia (ele pode já ter sido fechado).')
}

export async function reabrirDia(diaId: string) {
  const r = ok(await supabase.from('dias').update({ status: 'aberto' }).eq('id', diaId).select('id'))
  if (!r.length) throw new Error('Não foi possível reabrir o dia.')
}

/** Apaga o dia inteiro com produtos do dia, vendas, reservas e fiados. Não dá para desfazer. */
export async function excluirDia(diaId: string) {
  const d = okTalvez(await supabase.from('dias').select('status').eq('id', diaId).maybeSingle())
  if (!d) throw new Error('Dia não encontrado.')
  if (d.status === 'fechado') await reabrirDia(diaId)
  const r = ok(await supabase.from('dias').delete().eq('id', diaId).select('id'))
  if (!r.length) throw new Error('Não foi possível excluir o dia.')
}

// ---------------------------------------------------------------- produtos do dia

export async function salvarItemDia(id: string, produzido: number | null, preco: number) {
  const r = ok(await supabase.from('itens_dia').update({ produzido, preco: paraBanco(preco) }).eq('id', id).select('id'))
  if (!r.length) throw new Error('Produto do dia não encontrado.')
}

export async function adicionarItemDia(diaId: string, produto: Produto, produzido: number | null, preco: number) {
  ok(
    await supabase
      .from('itens_dia')
      .insert({ dia_id: diaId, produto_id: produto.id, nome: produto.nome, produzido, preco: paraBanco(preco), custo: 0 })
      .select('id'),
  )
}

/** Tira um produto do dia, só se ainda não teve venda nem reserva dele. */
export async function removerItemDia(id: string) {
  const usados = ok(await supabase.from('pedido_itens').select('id').eq('item_dia_id', id).limit(1))
  if (usados.length) throw new Error('Esse produto já tem vendas neste dia. Desfaça as vendas antes de tirá-lo.')
  ok(await supabase.from('itens_dia').delete().eq('id', id).select('id'))
}

// ---------------------------------------------------------------- vendas (pedidos)

export interface PedidoParaSalvar {
  id?: string
  diaId: string
  cliente: string
  status: StatusPedido
  pagamento: Pagamento | null
  desconto: number
  observacao?: string
  criadoEm?: string
  itens: { itemDiaId: string; quantidade: number; precoUnit: number }[]
}

/**
 * Venda lançada num dia anterior: a hora real não existe; grava ao meio-dia de Belém daquela data,
 * para ficar no dia certo.
 */
export const horaParaDia = (data: string) => (data < hojeBelem() ? `${data}T15:00:00Z` : undefined)

export async function salvarPedido(p: PedidoParaSalvar): Promise<string> {
  return ok(
    await supabase.rpc('salvar_pedido', {
      p: {
        id: p.id ?? null,
        dia_id: p.diaId,
        cliente: p.cliente.trim(),
        status: p.status,
        pagamento: p.pagamento,
        desconto: paraBanco(p.desconto),
        observacao: p.observacao ?? '',
        criado_em: p.criadoEm ?? '',
        itens: p.itens.map((i) => ({ item_dia_id: i.itemDiaId, quantidade: i.quantidade, preco_unit: paraBanco(i.precoUnit) })),
      },
    }),
  ) as string
}

export async function carregarPedido(id: string): Promise<Pedido | null> {
  const p = okTalvez(await supabase.from('pedidos').select('*, clientes(nome), pedido_itens(id, item_dia_id, quantidade, preco_unit, subtotal)').eq('id', id).maybeSingle())
  return p ? paraPedido(p) : null
}

export async function excluirPedido(id: string) {
  const r = ok(await supabase.from('pedidos').delete().eq('id', id).select('id'))
  if (!r.length) throw new Error('A venda não foi encontrada (talvez já tenha sido desfeita).')
}

// ---------------------------------------------------------------- fiado

export interface Fiado {
  pedidoId: string
  diaId: string
  data: string // dia da venda
  clienteId: string
  cliente: string
  itens: string // "2× Empada de frango, 1× Pudim"
  valor: number
  pagoEm: string | null
  pagoCom: FormaRecebimento | null
}

const descreverItens = (lista: Linha[]) => lista.map((i) => `${i.quantidade}× ${i.itens_dia?.nome ?? '—'}`).join(', ')

export async function listarFiados(): Promise<Fiado[]> {
  const ps = ok(
    await supabase
      .from('pedidos')
      .select('id, dia_id, total, cliente_id, criado_em, fiado_pago_em, fiado_pago_com, clientes(nome), dias(data), pedido_itens(quantidade, itens_dia(nome))')
      .eq('pagamento', 'fiado')
      .eq('status', 'concluido')
      .order('criado_em', { ascending: false })
      .limit(1000),
  ) as Linha[]
  return ps.map((p) => ({
    pedidoId: p.id,
    diaId: p.dia_id,
    data: p.dias?.data ?? p.criado_em.slice(0, 10),
    clienteId: p.cliente_id,
    cliente: p.clientes?.nome ?? '—',
    itens: descreverItens(p.pedido_itens ?? []),
    valor: deBanco(p.total),
    pagoEm: p.fiado_pago_em ?? null,
    pagoCom: p.fiado_pago_com ?? null,
  }))
}

/** Registra o pagamento de um ou mais fiados (aparece no resumo do dia de cada venda). */
export async function receberFiados(pedidoIds: string[], forma: FormaRecebimento, data = hojeBelem()) {
  const r = ok(
    await supabase.from('pedidos').update({ fiado_pago_em: data, fiado_pago_com: forma }).in('id', pedidoIds).eq('pagamento', 'fiado').select('id'),
  )
  if (r.length !== pedidoIds.length) throw new Error('Alguns fiados não foram encontrados. Atualize a tela.')
}

export async function desfazerRecebimento(pedidoId: string) {
  ok(await supabase.from('pedidos').update({ fiado_pago_em: null, fiado_pago_com: null }).eq('id', pedidoId).select('id'))
}

export async function trocarFormaRecebimento(pedidoId: string, forma: FormaRecebimento) {
  ok(await supabase.from('pedidos').update({ fiado_pago_com: forma }).eq('id', pedidoId).not('fiado_pago_em', 'is', null).select('id'))
}

// ---------------------------------------------------------------- produtos

export async function listarProdutos(): Promise<Produto[]> {
  const ps = ok(await supabase.from('produtos').select('id, nome, preco_padrao, unidade, categoria, ativo').order('nome'))
  return ps.map(paraProduto).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Cria o produto; se já existiu (com o mesmo nome) e foi desativado, reativa com os dados novos. */
export async function criarProduto(p: { nome: string; preco: number; unidade: string; categoria: string | null }): Promise<Produto> {
  const r = ok(
    await supabase
      .from('produtos')
      .upsert(
        { nome: p.nome.trim(), preco_padrao: paraBanco(p.preco), unidade: p.unidade.trim() || 'un', categoria: p.categoria?.trim() || null, ativo: true },
        { onConflict: 'nome' },
      )
      .select('id, nome, preco_padrao, unidade, categoria, ativo')
      .single(),
  )
  return paraProduto(r)
}

export async function salvarProduto(id: string, campos: Partial<{ nome: string; preco: number; unidade: string; categoria: string | null; ativo: boolean }>) {
  const dados: Record<string, unknown> = {}
  if (campos.nome !== undefined) dados.nome = campos.nome.trim()
  if (campos.preco !== undefined) dados.preco_padrao = paraBanco(campos.preco)
  if (campos.unidade !== undefined) dados.unidade = campos.unidade.trim() || 'un'
  if (campos.categoria !== undefined) dados.categoria = campos.categoria?.trim() || null
  if (campos.ativo !== undefined) dados.ativo = campos.ativo
  const r = ok(await supabase.from('produtos').update(dados).eq('id', id).select('id'))
  if (!r.length) throw new Error('Produto não encontrado.')
}

// ---------------------------------------------------------------- clientes

export interface ResumoCliente extends Cliente {
  compras: number
  total: number
  deve: number
  ultimaCompra: string | null
}

export async function listarClientes(): Promise<ResumoCliente[]> {
  const cs = ok(
    await supabase.from('clientes').select('id, nome, telefone, pedidos(total, status, pagamento, fiado_pago_em, criado_em)').order('nome'),
  ) as Linha[]
  return cs
    .map((c) => {
      const ps = (c.pedidos as Linha[]).filter((p) => p.status === 'concluido')
      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone ?? null,
        compras: ps.length,
        total: ps.reduce((s, p) => s + deBanco(p.total), 0),
        deve: ps.filter((p) => p.pagamento === 'fiado' && !p.fiado_pago_em).reduce((s, p) => s + deBanco(p.total), 0),
        ultimaCompra: ps.map((p) => p.criado_em as string).sort().at(-1) ?? null,
      }
    })
    .sort((a, b) => (b.ultimaCompra ?? '').localeCompare(a.ultimaCompra ?? '') || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export interface CompraCliente {
  pedidoId: string
  diaId: string
  data: string
  itens: string
  total: number
  status: StatusPedido
  pagamento: Pagamento | null
  fiadoPagoEm: string | null
  fiadoPagoCom: FormaRecebimento | null
}

export async function carregarCliente(id: string): Promise<{ cliente: Cliente; compras: CompraCliente[] } | null> {
  const c = okTalvez(
    await supabase
      .from('clientes')
      .select('id, nome, telefone, pedidos(id, dia_id, total, status, pagamento, fiado_pago_em, fiado_pago_com, criado_em, dias(data), pedido_itens(quantidade, itens_dia(nome)))')
      .eq('id', id)
      .maybeSingle(),
  ) as Linha | null
  if (!c) return null
  const compras: CompraCliente[] = (c.pedidos as Linha[])
    .map((p) => ({
      pedidoId: p.id,
      diaId: p.dia_id,
      data: p.dias?.data ?? p.criado_em.slice(0, 10),
      itens: descreverItens(p.pedido_itens ?? []),
      total: deBanco(p.total),
      status: p.status,
      pagamento: p.pagamento ?? null,
      fiadoPagoEm: p.fiado_pago_em ?? null,
      fiadoPagoCom: p.fiado_pago_com ?? null,
    }))
    .sort((a, b) => b.data.localeCompare(a.data))
  return { cliente: { id: c.id, nome: c.nome, telefone: c.telefone ?? null }, compras }
}

export async function salvarCliente(id: string, campos: { nome: string; telefone: string }) {
  const r = ok(
    await supabase.from('clientes').update({ nome: campos.nome.trim(), telefone: campos.telefone.trim() || null }).eq('id', id).select('id'),
  )
  if (!r.length) throw new Error('Cliente não encontrado.')
}

/** Nomes para sugerir na venda: quem comprou mais recentemente primeiro. */
export async function nomesDeClientes(): Promise<string[]> {
  const ps = ok(await supabase.from('pedidos').select('criado_em, clientes(nome)').not('cliente_id', 'is', null).order('criado_em', { ascending: false }).limit(400)) as Linha[]
  const vistos = new Map<string, string>()
  for (const p of ps) {
    const nome = p.clientes?.nome as string | undefined
    if (nome && !vistos.has(nome.toLocaleLowerCase('pt-BR'))) vistos.set(nome.toLocaleLowerCase('pt-BR'), nome)
  }
  const todos = ok(await supabase.from('clientes').select('nome').order('nome')) as Linha[]
  for (const c of todos) if (!vistos.has(c.nome.toLocaleLowerCase('pt-BR'))) vistos.set(c.nome.toLocaleLowerCase('pt-BR'), c.nome)
  return [...vistos.values()]
}
