import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { carregarCliente, mensagemErro, salvarCliente } from '../lib/api'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { useCarregar, useOnline } from '../hooks'
import { SeloPagamento } from '../components/ListaVendas'
import ReceberFiado from '../components/ReceberFiado'
import { Aviso, Campo, Carregando, Icone, Pagina, Topo, Vazio } from '../components/ui'

/** Ficha do cliente: tudo que comprou, quanto deve, editar nome e telefone. */
export default function ClienteFicha() {
  const { clienteId = '' } = useParams()
  const online = useOnline()
  const { dados, erro: erroCarga, carregando, recarregar } = useCarregar(() => carregarCliente(clienteId), [clienteId])
  const [editando, setEditando] = useState<{ nome: string; telefone: string } | null>(null)
  const [receber, setReceber] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (carregando && !dados) return <Pagina comNav><Topo titulo="Cliente" voltar="/clientes" /><Carregando /></Pagina>
  if (!dados) return <Pagina comNav><Topo titulo="Cliente" voltar="/clientes" /><Aviso>{erroCarga ?? 'Cliente não encontrado.'}</Aviso></Pagina>

  const { cliente, compras } = dados
  const concluidas = compras.filter((c) => c.status === 'concluido')
  const total = concluidas.reduce((s, c) => s + c.total, 0)
  // fiado em aberto (inclusive o pago em parte), da compra mais antiga para a mais nova
  const devendo = concluidas
    .filter((c) => c.pagamento === 'fiado' && c.pago < c.total)
    .map((c) => ({ ...c, falta: c.total - c.pago }))
    .sort((a, b) => a.data.localeCompare(b.data))
  const deve = devendo.reduce((s, c) => s + c.falta, 0)
  const zap = cliente.telefone?.replace(/\D/g, '')

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      await recarregar()
      setEditando(null)
      setReceber(false)
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Pagina largura="max-w-3xl" comNav>
      <Topo
        titulo={cliente.nome}
        sub={cliente.telefone ?? undefined}
        voltar="/clientes"
        acao={
          !editando && (
            <button type="button" className="btn-secundario shrink-0" onClick={() => setEditando({ nome: cliente.nome, telefone: cliente.telefone ?? '' })}>
              <Icone nome="lapis" tamanho={18} /> Editar
            </button>
          )
        }
      />

      {editando && (
        <section className="cartao mb-4 space-y-3 p-4">
          <Campo id="nome" rotulo="Nome" valor={editando.nome} onChange={(v) => setEditando({ ...editando, nome: v })} modo="text" />
          <Campo id="tel" rotulo="Telefone (opcional)" valor={editando.telefone} onChange={(v) => setEditando({ ...editando, telefone: v })} modo="tel" placeholder="(91) 9 9999-9999" />
          <div className="flex gap-2">
            <button type="button" className="btn-secundario flex-1" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primario flex-1"
              disabled={ocupado || !online || !editando.nome.trim()}
              onClick={() => executar(() => salvarCliente(cliente.id, editando))}
            >
              Salvar
            </button>
          </div>
        </section>
      )}

      {(erro || erroCarga) && (
        <div className="mb-3">
          <Aviso>{erro ?? erroCarga}</Aviso>
        </div>
      )}

      <div className="num grid grid-cols-3 gap-3">
        <div className="cartao p-4">
          <p className="rotulo">Compras</p>
          <p className="mt-1 text-2xl font-extrabold">{concluidas.length}</p>
        </div>
        <div className="cartao p-4">
          <p className="rotulo">Total</p>
          <p className="mt-1 text-2xl font-extrabold">{reais(total)}</p>
        </div>
        <div className={`cartao p-4 ${deve ? 'border-alerta/40' : ''}`}>
          <p className={`rotulo ${deve ? 'text-alerta' : ''}`}>Deve</p>
          <p className={`mt-1 text-2xl font-extrabold ${deve ? 'text-alerta' : ''}`}>{reais(deve)}</p>
        </div>
      </div>

      {(deve > 0 || zap) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {deve > 0 && (
            <button type="button" className="btn-primario flex-1" onClick={() => setReceber(true)} disabled={!online}>
              Receber (deve {reais(deve)})
            </button>
          )}
          {zap && (
            <a
              className="btn-secundario flex-1"
              href={`https://wa.me/55${zap}${deve ? `?text=${encodeURIComponent(`Olá, ${cliente.nome}! Passando para lembrar do valor de ${reais(deve)} em aberto. Obrigado!`)}` : ''}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          )}
        </div>
      )}

      <h2 className="rotulo mb-2 mt-6 px-1">Compras</h2>
      {!compras.length ? (
        <Vazio>Nenhuma compra registrada.</Vazio>
      ) : (
        <ul className="num cartao divide-y divide-borda/60">
          {compras.map((c) => (
            <li key={c.pedidoId}>
              <Link to={`/dia/${c.diaId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-borda/30">
                <div className="min-w-0">
                  <p className="truncate">{c.itens}</p>
                  <p className="text-sm text-sec">
                    {diaDaSemana(c.data).split('-')[0]}, {dataCurta(c.data)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold">{reais(c.total)}</p>
                  {c.pagamento === 'fiado' && c.pago > 0 && c.pago < c.total ? (
                    <span className="text-xs font-semibold text-alerta">pagou {reais(c.pago)} · falta {reais(c.total - c.pago)}</span>
                  ) : (
                    <SeloPagamento p={c} />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ReceberFiado
        alvo={receber ? { clienteId: cliente.id, cliente: cliente.nome, falta: deve, vendas: devendo } : null}
        onFechar={() => setReceber(false)}
        onRecebido={recarregar}
      />
    </Pagina>
  )
}
