// Tipos do sistema. Dinheiro é sempre centavos inteiros; datas de calendário são AAAA-MM-DD.

export type Pagamento = 'pix' | 'dinheiro' | 'cartao' | 'fiado' | 'nao_informado'
export type FormaRecebimento = 'pix' | 'dinheiro' | 'cartao'
export type StatusPedido = 'concluido' | 'reservado'

/** Formas que aparecem na tela de venda ("não informado" só existe em dias antigos migrados). */
export const FORMAS_VENDA: { valor: Exclude<Pagamento, 'nao_informado'>; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'fiado', rotulo: 'Fiado' },
]
export const FORMAS_RECEBIMENTO: { valor: FormaRecebimento; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao', rotulo: 'Cartão' },
]
export const ROTULO_PAGAMENTO: Record<Pagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  fiado: 'Fiado',
  nao_informado: 'Não informado',
}

/** Unidades sugeridas no cadastro (o campo aceita qualquer texto curto). */
export const UNIDADES = ['un', 'fatia', 'pote', 'pedaço', 'caixa', 'pacote', 'garrafa', 'copo']

/** Pix e fiado exigem o nome de quem pagou / vai pagar; reserva exige quem vai buscar. */
export const exigeCliente = (status: StatusPedido, pagamento: Pagamento | null) =>
  status === 'reservado' || pagamento === 'pix' || pagamento === 'fiado'

export interface Produto {
  id: string
  nome: string
  preco: number
  unidade: string
  categoria: string | null
  ativo: boolean
}

export interface Cliente {
  id: string
  nome: string
  telefone: string | null
}

export interface Dia {
  id: string
  data: string
  status: 'aberto' | 'fechado'
  gasto: number | null // centavos; null = não informado
  semGasto: boolean // "não teve gasto" (N/A)
  fechadoEm: string | null
}

/** Produto vendido num dia, com o preço e a quantidade daquele dia. */
export interface ItemDia {
  id: string
  produtoId: string
  nome: string
  unidade: string
  produzido: number | null // null = sem controle de estoque
  preco: number
}

export interface PedidoItem {
  id: string
  itemDiaId: string
  quantidade: number
  precoUnit: number
  subtotal: number
}

export interface Pedido {
  id: string
  diaId: string
  clienteId: string | null
  cliente: string | null
  status: StatusPedido
  pagamento: Pagamento | null // null só em reserva
  desconto: number // negativo = acréscimo
  total: number // valor cobrado
  observacao: string | null
  fiadoPagoEm: string | null
  fiadoPagoCom: FormaRecebimento | null
  criadoEm: string
  itens: PedidoItem[]
}

export interface DiaCompleto {
  dia: Dia
  itens: ItemDia[]
  pedidos: Pedido[]
}
