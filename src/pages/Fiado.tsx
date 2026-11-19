import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  desfazerRecebimento,
  listarFiados,
  listarPagamentosFiado,
  mensagemErro,
  trocarFormaRecebimento,
  type Fiado as FiadoT,
  type PagamentoFiado,
} from '../lib/api'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { FORMAS_RECEBIMENTO, ROTULO_PAGAMENTO, type FormaRecebimento } from '../lib/tipos'
import { useCarregar, useOnline } from '../hooks'
import ReceberFiado, { type AlvoRecebimento } from '../components/ReceberFiado'
import DetalheVenda from '../components/DetalheVenda'
import { Aviso, Barra, Carregando, Confirmar, Escolha, Icone, Pagina, Selo, TituloSecao, Vazio } from '../components/ui'

interface Devedor {
  clienteId: string
  nome: string
  falta: number
  total: number
  fiados: FiadoT[]
}

/** Quem deve, quanto, e os pagamentos recebidos (inteiros ou parciais). */
export default function Fiado() {
  const online = useOnline()
  const { dados, erro: erroCarga, carregando, recarregar } = useCarregar(
    async () => ({ fiados: await listarFiados(), pagamentos: await listarPagamentosFiado() }),
    [],
    30000,
  )
  const [aba, setAba] = useState<'abertos' | 'recebidos'>('abertos')
  const [receber, setReceber] = useState<AlvoRecebimento | null>(null)
  const [trocar, setTrocar] = useState<PagamentoFiado | null>(null)
  const [desfazer, setDesfazer] = useState<PagamentoFiado | null>(null)
  const [forma, setForma] = useState<FormaRecebimento>('pix')
  const [ver, setVer] = useState<{ pedidoId: string; diaId?: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const abertos = dados?.fiados.filter((f) => f.falta > 0) ?? []
  const totalAberto = abertos.reduce((s, f) => s + f.falta, 0)

  const porCliente = new Map<string, Devedor>()
  for (const f of abertos) {
    const g = porCliente.get(f.clienteId) ?? { clienteId: f.clienteId, nome: f.cliente, falta: 0, total: 0, fiados: [] }
    g.falta += f.falta
    g.total += f.valor
    g.fiados.push(f)
    porCliente.set(f.clienteId, g)
  }
  const devedores = [...porCliente.values()]
    .map((g) => ({ ...g, fiados: [...g.fiados].sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.falta - a.falta)

  const porDia = new Map<string, PagamentoFiado[]>()
  for (const p of dados?.pagamentos ?? []) porDia.set(p.data, [...(porDia.get(p.data) ?? []), p])

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      await recarregar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setOcupado(false)
      setTrocar(null)
      setDesfazer(null)
    }
  }

  return (
    <Pagina largura="max-w-3xl" comNav>
      <TituloSecao titulo="Fiado" sub="Vendas para pagar depois — aceita pagamento por conta" />
      {(erro || erroCarga) && (
        <div className="mb-3">
          <Aviso>{erro ?? erroCarga}</Aviso>
        </div>
      )}

      {carregando && !dados ? (
        <Carregando />
      ) : (
        <div className="num space-y-4">
          <section className={`painel flex flex-wrap items-end justify-between gap-3 p-5 ${totalAberto ? 'border-alerta/40' : ''}`}>
            <div>
              <p className={`rotulo ${totalAberto ? 'text-alerta' : ''}`}>Total a receber</p>
              <p className={`mt-1 text-4xl font-extrabold ${totalAberto ? 'text-alerta' : ''}`}>{reais(totalAberto)}</p>
            </div>
            <p className="text-sm text-sec">
              {devedores.length} {devedores.length === 1 ? 'cliente' : 'clientes'} · {abertos.length} {abertos.length === 1 ? 'venda' : 'vendas'}
            </p>
          </section>

          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-borda bg-cartao p-1" role="tablist">
            {(
              [
                ['abertos', `A receber (${devedores.length})`],
                ['recebidos', 'Pagamentos recebidos'],
              ] as const
            ).map(([v, t]) => (
              <button key={v} type="button" role="tab" aria-selected={aba === v} className={`btn min-h-11 text-sm sm:text-base ${aba === v ? 'bg-destaque text-fundo' : 'text-sec'}`} onClick={() => setAba(v)}>
                {t}
              </button>
            ))}
          </div>

          {aba === 'abertos' ? (
            devedores.length === 0 ? (
              <Vazio>Ninguém devendo. 🎉</Vazio>
            ) : (
              devedores.map((g) => (
                <section key={g.clienteId} className="cartao overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-4 py-3">
                    <Link to={`/clientes/${g.clienteId}`} className="min-w-0 hover:underline">
                      <h2 className="truncate text-lg font-bold">{g.nome}</h2>
                      <p className="text-sm text-sec">
                        {g.fiados.length} {g.fiados.length === 1 ? 'compra' : 'compras'} · desde {dataCurta(g.fiados[0].data)}
                      </p>
                    </Link>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xl font-extrabold text-alerta">{reais(g.falta)}</p>
                        {g.falta < g.total && <p className="text-xs text-sec">já pagou {reais(g.total - g.falta)}</p>}
                      </div>
                      <button
                        type="button"
                        className="btn-primario px-4"
                        onClick={() => setReceber({ clienteId: g.clienteId, cliente: g.nome, falta: g.falta, vendas: g.fiados })}
                        disabled={!online || ocupado}
                      >
                        Receber
                      </button>
                    </div>
                  </div>
                  <ul className="divide-y divide-borda/60">
                    {g.fiados.map((f) => (
                      <li key={f.pedidoId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <button type="button" onClick={() => setVer({ pedidoId: f.pedidoId, diaId: f.diaId })} className="min-w-0 flex-1 rounded-lg text-left hover:bg-borda/20" title="Ver o que comprou">
                          <p className="truncate">{f.itens}</p>
                          <p className="text-sm text-sec">
                            {diaDaSemana(f.data).split('-')[0]}, {dataCurta(f.data)}
                            {f.pago > 0 && ` · pagou ${reais(f.pago)} de ${reais(f.valor)}`}
                          </p>
                          {f.pago > 0 && (
                            <div className="mt-1 max-w-48">
                              <Barra valor={f.pago} total={f.valor} />
                            </div>
                          )}
                          <p className="text-xs font-semibold text-destaque">Ver compra</p>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-bold">{reais(f.falta)}</span>
                          {g.fiados.length > 1 && (
                            <button
                              type="button"
                              className="btn-secundario px-3 text-sm"
                              onClick={() => setReceber({ clienteId: g.clienteId, cliente: g.nome, falta: f.falta, vendas: [f], soEstas: true })}
                              disabled={!online || ocupado}
                            >
                              Só esta
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )
          ) : porDia.size === 0 ? (
            <Vazio>Nenhum pagamento de fiado ainda.</Vazio>
          ) : (
            [...porDia.entries()].map(([data, lista]) => (
              <section key={data} className="space-y-2">
                <h2 className="rotulo px-1">
                  {diaDaSemana(data).split('-')[0]}, {dataCurta(data)} · {reais(lista.reduce((s, p) => s + p.valor, 0))}
                </h2>
                <ul className="cartao divide-y divide-borda/60">
                  {lista.map((p) => (
                    <li key={p.lote} className="flex items-center justify-between gap-2 px-4 py-3">
                      <button type="button" className="min-w-0 flex-1 rounded-lg text-left hover:bg-borda/20" onClick={() => p.vendas[0]?.pedidoId && setVer({ pedidoId: p.vendas[0].pedidoId })} title="Ver o que comprou">
                        <p className="truncate font-semibold">{p.cliente}</p>
                        <p className="truncate text-sm text-sec">
                          {p.vendas.length === 1 ? `${p.vendas[0].itens} · venda de ${dataCurta(p.vendas[0].data)}` : `abateu ${p.vendas.length} vendas`}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <div className="text-right">
                          <p className="font-bold">{reais(p.valor)}</p>
                          <Selo cor="positivo">{ROTULO_PAGAMENTO[p.forma]}</Selo>
                        </div>
                        <button
                          type="button"
                          className="grid size-11 place-items-center rounded-xl text-sec hover:bg-destaque/10 hover:text-claro"
                          onClick={() => {
                            setForma(p.forma)
                            setTrocar(p)
                          }}
                          disabled={!online || ocupado}
                          aria-label="Trocar forma de pagamento"
                          title="Trocar forma de pagamento"
                        >
                          <Icone nome="lapis" tamanho={18} />
                        </button>
                        <button
                          type="button"
                          className="grid size-11 place-items-center rounded-xl text-sec hover:bg-alerta/10 hover:text-alerta"
                          onClick={() => setDesfazer(p)}
                          disabled={!online || ocupado}
                          aria-label="Desfazer pagamento"
                          title="Desfazer pagamento"
                        >
                          <Icone nome="desfazer" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      <DetalheVenda pedidoId={ver?.pedidoId} diaId={ver?.diaId} onFechar={() => setVer(null)} />

      <ReceberFiado alvo={receber} onFechar={() => setReceber(null)} onRecebido={recarregar} />

      <Confirmar
        aberto={trocar !== null}
        titulo={`Como ${trocar?.cliente} pagou ${trocar ? reais(trocar.valor) : ''}?`}
        confirmar="Salvar"
        ocupado={ocupado}
        onConfirmar={() => trocar && executar(() => trocarFormaRecebimento(trocar.lote, forma))}
        onCancelar={() => setTrocar(null)}
      >
        <Escolha nome="forma-troca" opcoes={FORMAS_RECEBIMENTO} valor={forma} onChange={setForma} />
      </Confirmar>

      <Confirmar
        aberto={desfazer !== null}
        titulo={`Desfazer o pagamento de ${desfazer ? reais(desfazer.valor) : ''}?`}
        confirmar="Desfazer"
        perigo
        ocupado={ocupado}
        onConfirmar={() => desfazer && executar(() => desfazerRecebimento(desfazer.lote))}
        onCancelar={() => setDesfazer(null)}
      >
        O valor volta a ficar devendo para {desfazer?.cliente}.
      </Confirmar>
    </Pagina>
  )
}
