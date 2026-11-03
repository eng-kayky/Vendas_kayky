import { supabase } from './supabase'
import { deBanco, paraBanco } from './dinheiro'
import { hojeBelem } from './datas'
import {
  calcularResumo,
  criarSnapshot,
  listarVendasDoDia,
  type FormaRecebimento,
  type Pagamento,
  type SituacaoFiado,
  type Snapshot,
  type StatusVenda,
} from './resumo'

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
}

export interface Venda {
  id: string
  item_dia_id: string
  quantidade: number
  valor_cobrado: number // centavos
  pagamento: Pagamento | null // null só em reserva
  status: StatusVenda
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
}

/** Mensagem legível para erros do Supabase/Postgres. */
export function mensagemErro(e: unknown): string {
  const err = e as { message?: string; code?: string }
  if (!navigator.onLine) return 'Sem conexão com a internet. Nada foi salvo.'
  if (err?.code === '23505')
    return err.message?.includes('produtos') ? 'Já existe um produto com esse nome.' : 'Já existe um registro para esse dia.'
  if (err?.message?.includes('cliente_obrigatorio_no_pix')) return 'No Pix e no fiado, o nome do cliente é obrigatório.'
  if (err?.message?.includes('vendas_pagamento_check'))
    return 'O banco ainda não aceita fiado. Rode o arquivo 0002_fiado.sql no SQL Editor do Supabase.'
  if (err?.code === '42P01' || err?.code === 'PGRST205')
    return 'O banco ainda não tem a parte de fiado. Rode o arquivo 0002_fiado.sql no SQL Editor do Supabase.'
  if (err?.message?.includes('column') && err.message.includes('status'))
    return 'O banco ainda não tem a parte de reservas. Rode o arquivo 0003_reservas.sql no SQL Editor do Supabase.'
  if (err?.message?.includes('pagamento_obrigatorio_na_venda')) return 'Escolha a forma de pagamento.'
  if (err?.message?.includes('cliente_obrigatorio_na_reserva')) return 'Na reserva, o nome do cliente é obrigatório.'
  if (err?.code === '23503' && err.message?.includes('fiado'))
    return 'Essa venda fiado já foi recebida. Desfaça o recebimento na tela Fiado antes.'
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
})

const paraVenda = (v: Linha): Venda => ({
  id: v.id as string,
  item_dia_id: v.item_dia_id as string,
  quantidade: v.quantidade as number,
  valor_cobrado: deBanco(v.valor_cobrado as string),
  pagamento: (v.pagamento as Pagamento) ?? null,
  status: (v.status as StatusVenda) ?? 'concluida', // banco sem a migração 0003 não tem a coluna
  cliente: (v.cliente as string) ?? null,
  criado_em: v.criado_em as string,
})

async function completar(dia: Dia): Promise<DiaCompleto> {
  const itens = ok(
    await supabase.from('itens_dia').select('id, produto_id, nome, produzido, preco').eq('dia_id', dia.id).order('nome'),
  ).map(paraItem)
  const ids = itens.map((i) => i.id)
  const vendas = ids.length
    ? ok(
        await supabase
          .from('vendas')
          .select('*') // inclui "status" quando o banco já tem a migração 0003
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

/** Tela onde o dia é trabalhado: hoje fica em "/", um dia anterior reaberto em "/dia/:id". */
export function telaDoDia(dia: { id: string; data: string }) {
  return dia.data === hojeBelem() ? '/' : `/dia/${dia.id}`
}

/** Dia (com itens e vendas) ao qual um produto do dia pertence. */
export async function carregarDiaDoItem(itemId: string): Promise<DiaCompleto | null> {
  const i = okTalvez(await supabase.from('itens_dia').select('dia_id').eq('id', itemId).maybeSingle())
  return i ? carregarDiaPorId(i.dia_id as string) : null
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
  const produtos = ok(await supabase.from('produtos').select('id, nome, preco_padrao').eq('ativo', true).order('criado_em'))
  const ultimos = ok(await supabase.from('ultimos_valores').select('produto_id, produzido, preco'))
  const mapa = new Map(ultimos.map((u) => [u.produto_id as string, u]))
  return produtos.map((p) => {
    const u = mapa.get(p.id)
    return {
      produto_id: p.id,
      nome: p.nome,
      produzido: (u?.produzido as number) ?? 0,
      preco: deBanco(u ? (u.preco as string) : p.preco_padrao),
    }
  })
}

/** Cria o produto; se já existiu e foi removido, reativa com o novo preço. */
export async function criarProduto(nome: string, preco: number): Promise<string> {
  const p = ok(
    await supabase
      .from('produtos')
      .upsert({ nome: nome.trim(), preco_padrao: paraBanco(preco), ativo: true }, { onConflict: 'nome' })
      .select('id')
      .single(),
  )
  return p.id
}

/** Tira o produto da lista de "Abrir o dia" (o histórico continua intacto). */
export async function removerProduto(id: string) {
  const r = ok(await supabase.from('produtos').update({ ativo: false }).eq('id', id).select('id'))
  if (!r.length) throw new Error('Produto não encontrado.')
}

export async function abrirDia(itens: ProdutoAbrir[]): Promise<string> {
  // O custo por unidade não é mais usado; o gasto do dia é informado ao finalizar
  const payload = itens.map((i) => ({
    produto_id: i.produto_id,
    produzido: i.produzido,
    preco: paraBanco(i.preco),
    custo: '0.00',
  }))
  return ok(await supabase.rpc('abrir_dia', { p_itens: payload })) as string
}

/**
 * Venda lançada num dia anterior: a hora real não existe, então grava ao meio-dia de Belém
 * daquela data (fica dentro do dia certo no histórico e na imagem).
 */
export function horaParaDia(data: string): string | undefined {
  return data < hojeBelem() ? `${data}T15:00:00Z` : undefined
}

export async function registrarVenda(v: {
  item_dia_id: string
  quantidade: number
  valor_cobrado: number
  pagamento: Pagamento
  cliente: string
  criado_em?: string
}) {
  const cliente = v.cliente.trim()
  ok(
    await supabase
      .from('vendas')
      .insert({
        item_dia_id: v.item_dia_id,
        quantidade: v.quantidade,
        valor_cobrado: paraBanco(v.valor_cobrado),
        pagamento: v.pagamento,
        cliente: cliente || null,
        ...(v.criado_em ? { criado_em: v.criado_em } : {}),
      })
      .select('id'),
  )
}

/** Separa unidades para o cliente buscar depois (ainda não é venda). */
export async function registrarReserva(v: {
  item_dia_id: string
  quantidade: number
  valor_cobrado: number
  cliente: string
  criado_em?: string
}) {
  ok(
    await supabase
      .from('vendas')
      .insert({
        item_dia_id: v.item_dia_id,
        quantidade: v.quantidade,
        valor_cobrado: paraBanco(v.valor_cobrado),
        pagamento: null,
        status: 'reservada',
        cliente: v.cliente.trim(),
        ...(v.criado_em ? { criado_em: v.criado_em } : {}),
      })
      .select('id'),
  )
}

export async function carregarVenda(id: string): Promise<Venda | null> {
  const v = okTalvez(await supabase.from('vendas').select('*').eq('id', id).maybeSingle())
  return v ? paraVenda(v) : null
}

/**
 * Corrige uma venda (ou entrega uma reserva, passando status 'concluida').
 * Fiado já recebido não pode trocar de forma de pagamento: desfaça o recebimento antes.
 */
export async function atualizarVenda(
  id: string,
  v: { quantidade: number; valor_cobrado: number; pagamento: Pagamento; cliente: string; status?: StatusVenda },
) {
  const atual = await carregarVenda(id)
  if (!atual) throw new Error('Venda não encontrada.')
  if (atual.pagamento === 'fiado' && v.pagamento !== 'fiado') {
    const rec = await supabase.from('fiado_pagamentos').select('id').eq('venda_id', id).limit(1)
    if (rec.data?.length) throw new Error('Esse fiado já foi recebido. Desfaça o recebimento na tela Fiado antes de trocar a forma de pagamento.')
  }
  const cliente = v.cliente.trim()
  const dados: Record<string, unknown> = {
    quantidade: v.quantidade,
    valor_cobrado: paraBanco(v.valor_cobrado),
    pagamento: v.pagamento,
    cliente: cliente || null,
  }
  if (v.status) dados.status = v.status
  const r = ok(await supabase.from('vendas').update(dados).eq('id', id).select('id'))
  if (!r.length) throw new Error('Não foi possível salvar a venda.')
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

/**
 * Recarrega o dia do banco, calcula o resumo e grava o snapshot fechando o dia.
 * `gasto`: gasto com material em centavos, ou null quando não teve gasto (N/A).
 */
export async function finalizarDia(diaId: string, gasto: number | null): Promise<Snapshot> {
  const atual = await carregarDiaPorId(diaId)
  if (!atual) throw new Error('Dia não encontrado.')
  if (atual.dia.status === 'fechado') throw new Error('Este dia já está fechado.')
  const resumo = calcularResumo(atual.itens, atual.vendas)
  if (resumo.totais.reservas) throw new Error('Ainda há reservas em aberto. Entregue ou cancele antes de finalizar.')
  const lista = listarVendasDoDia(atual.itens, atual.vendas)
  const snapshot = criarSnapshot(atual.dia.data, resumo, gasto, new Date().toISOString(), lista)
  const r = ok(
    await supabase.from('dias').update({ status: 'fechado', snapshot }).eq('id', diaId).eq('status', 'aberto').select('fechado_em'),
  )
  if (!r.length) throw new Error('Não foi possível fechar o dia (ele pode ter sido fechado por outra pessoa).')
  snapshot.fechado_em = r[0].fechado_em as string
  return snapshot
}

export async function reabrirDia(diaId: string) {
  const r = ok(await supabase.from('dias').update({ status: 'aberto' }).eq('id', diaId).select('id'))
  if (!r.length) throw new Error('Não foi possível reabrir o dia.')
}

export interface DiaHistorico {
  id: string
  data: string
  status: Dia['status']
  liquido: number | null
  lucro: number | null
  resumido: boolean
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
      resumido: s?.tipo === 'resumo',
    }
  })
}

// ---------- Relatório do período ----------

/** Dias do período: os fechados (com resumo) entram no relatório; os abertos só são avisados. */
export async function diasDoPeriodo(inicio: string, fim: string) {
  const dias = ok(
    await supabase.from('dias').select('id, data, status, snapshot').gte('data', inicio).lte('data', fim).order('data'),
  )
  const fechados = dias.filter((d) => d.status === 'fechado' && d.snapshot).map((d) => d.snapshot as Snapshot)
  const abertos = dias.filter((d) => d.status !== 'fechado').map((d) => ({ id: d.id as string, data: d.data as string }))
  const fiados = fechados.flatMap((s) => (s.vendas_lista ?? []).filter((v) => v.pagamento === 'fiado').map((v) => v.venda_id))
  return { fechados, abertos, situacao: await situacaoFiados(fiados) }
}

// ---------- Dias anteriores lançados por resumo ----------

export async function diaJaExiste(data: string): Promise<boolean> {
  const d = okTalvez(await supabase.from('dias').select('id').eq('data', data).maybeSingle())
  return d !== null
}

/** Grava um dia anterior já fechado, só com o resumo (sem venda a venda). */
export async function lancarDiaAnterior(snapshot: Snapshot): Promise<string> {
  if (snapshot.data >= hojeBelem()) throw new Error('Escolha uma data anterior a hoje.')
  const d = ok(
    await supabase
      .from('dias')
      .insert({ data: snapshot.data, status: 'fechado', snapshot, fechado_em: new Date().toISOString() })
      .select('id')
      .single(),
  )
  return d.id
}

/** Troca o resumo de um dia lançado (o banco só aceita mudar dia fechado reabrindo antes). */
export async function editarLancamento(diaId: string, snapshot: Snapshot) {
  await reabrirDia(diaId)
  const r = ok(await supabase.from('dias').update({ status: 'fechado', snapshot }).eq('id', diaId).select('id'))
  if (!r.length) throw new Error('Não foi possível salvar o lançamento.')
}

/** Exclui um dia lançado por resumo. Dias com venda a venda não passam por aqui. */
export async function excluirLancamento(diaId: string) {
  const atual = await carregarDiaPorId(diaId)
  if (!atual || atual.dia.snapshot?.tipo !== 'resumo' || atual.itens.length) {
    throw new Error('Só dá para excluir dias lançados por resumo.')
  }
  await reabrirDia(diaId)
  ok(await supabase.from('dias').delete().eq('id', diaId).select('id'))
}

// ---------- Cadastro de produtos ----------

export interface Produto {
  id: string
  nome: string
  preco: number // centavos
  ativo: boolean
}

export async function listarProdutos(): Promise<Produto[]> {
  const ps = ok(await supabase.from('produtos').select('id, nome, preco_padrao, ativo').order('ativo', { ascending: false }).order('nome'))
  return ps.map((p) => ({ id: p.id, nome: p.nome, preco: deBanco(p.preco_padrao), ativo: p.ativo }))
}

export async function salvarProduto(id: string, campos: { nome?: string; preco?: number; ativo?: boolean }) {
  const dados: Record<string, unknown> = {}
  if (campos.nome !== undefined) dados.nome = campos.nome.trim()
  if (campos.preco !== undefined) dados.preco_padrao = paraBanco(campos.preco)
  if (campos.ativo !== undefined) dados.ativo = campos.ativo
  const r = ok(await supabase.from('produtos').update(dados).eq('id', id).select('id'))
  if (!r.length) throw new Error('Produto não encontrado.')
}

// ---------- Fiado ----------

export interface Fiado {
  venda_id: string
  cliente: string
  produto: string
  quantidade: number
  valor: number // centavos
  data: string // dia da venda
  criado_em: string
  recebimento: { id: string; valor: number; pagamento: FormaRecebimento; data: string } | null
}

/** Vendas fiado (as em aberto primeiro, depois as recebidas mais recentes). */
export async function listarFiados(): Promise<Fiado[]> {
  const linhas = ok(
    await supabase
      .from('vendas')
      .select('id, quantidade, valor_cobrado, cliente, criado_em, itens_dia(nome, dias(data)), fiado_pagamentos(id, valor, pagamento, data)')
      .eq('pagamento', 'fiado')
      .order('criado_em', { ascending: false })
      .limit(500),
  ) as unknown as Linha[]
  return linhas.map((v) => {
    const item = v.itens_dia as { nome: string; dias: { data: string } | null } | null
    const pg = v.fiado_pagamentos as Linha | Linha[] | null
    const rec = Array.isArray(pg) ? pg[0] : pg
    return {
      venda_id: v.id as string,
      cliente: ((v.cliente as string) ?? '').trim(),
      produto: item?.nome ?? '—',
      quantidade: v.quantidade as number,
      valor: deBanco(v.valor_cobrado as string),
      data: item?.dias?.data ?? (v.criado_em as string).slice(0, 10),
      criado_em: v.criado_em as string,
      recebimento: rec
        ? { id: rec.id as string, valor: deBanco(rec.valor as string), pagamento: rec.pagamento as FormaRecebimento, data: rec.data as string }
        : null,
    }
  })
}

export async function receberFiado(f: Fiado, pagamento: FormaRecebimento) {
  ok(await supabase.from('fiado_pagamentos').insert({ venda_id: f.venda_id, valor: paraBanco(f.valor), pagamento }).select('id'))
}

export async function desfazerRecebimento(id: string) {
  const r = ok(await supabase.from('fiado_pagamentos').delete().eq('id', id).select('id'))
  if (!r.length) throw new Error('Recebimento não encontrado.')
}

/** Troca a forma com que o fiado foi pago (se registrou errado). */
export async function alterarRecebimento(id: string, pagamento: FormaRecebimento) {
  const r = ok(await supabase.from('fiado_pagamentos').update({ pagamento }).eq('id', id).select('id'))
  if (!r.length) throw new Error('Recebimento não encontrado.')
}

/** Situação atual dos fiados dessas vendas (para mostrar no resumo do dia da venda). */
export async function situacaoFiados(vendaIds: string[]): Promise<SituacaoFiado> {
  if (!vendaIds.length) return {}
  const r = await supabase.from('fiado_pagamentos').select('venda_id, pagamento, data').in('venda_id', vendaIds)
  if (r.error) return {}
  return Object.fromEntries(
    (r.data ?? []).map((p) => [p.venda_id as string, { pagamento: p.pagamento as FormaRecebimento, data: p.data as string }]),
  )
}

// ---------- Produtos do dia aberto ----------

export async function salvarItemDia(id: string, produzido: number, preco: number) {
  const r = ok(await supabase.from('itens_dia').update({ produzido, preco: paraBanco(preco) }).eq('id', id).select('id'))
  if (!r.length) throw new Error('Produto do dia não encontrado.')
}

export async function adicionarItemDia(diaId: string, produto: Produto, produzido: number, preco: number) {
  ok(
    await supabase
      .from('itens_dia')
      .insert({ dia_id: diaId, produto_id: produto.id, nome: produto.nome, produzido, preco: paraBanco(preco), custo: '0.00' })
      .select('id'),
  )
}

/** Tira um produto do dia, só se ele ainda não teve venda (apagar levaria as vendas junto). */
export async function removerItemDia(id: string) {
  const vendas = ok(await supabase.from('vendas').select('id').eq('item_dia_id', id).limit(1))
  if (vendas.length) throw new Error('Esse produto já tem vendas hoje. Desfaça as vendas antes de tirá-lo do dia.')
  ok(await supabase.from('itens_dia').delete().eq('id', id).select('id'))
}
