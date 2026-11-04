import { useState } from 'react'
import { Link } from 'react-router-dom'
import { desfazerRecebimento, listarFiados, mensagemErro, receberFiados, trocarFormaRecebimento, type Fiado as FiadoT } from '../lib/api'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { FORMAS_RECEBIMENTO, ROTULO_PAGAMENTO, type FormaRecebimento } from '../lib/tipos'
import { useCarregar, useOnline } from '../hooks'
import { Aviso, Carregando, Confirmar, Escolha, Icone, Pagina, Selo, TituloSecao, Vazio } from '../components/ui'

interface Devedor {
  clienteId: string
  nome: string
  total: number
  fiados: FiadoT[]
}

/** Quem deve, quanto, e o que já foi recebido. */
export default function Fiado() {
  const online = useOnline()
  const { dados, erro: erroCarga, carregando, recarregar } = useCarregar(listarFiados, [], 30000)
  const [aba, setAba] = useState<'abertos' | 'recebidos'>('abertos')
  const [receber, setReceber] = useState<{ titulo: string; fiados: FiadoT[] } | null>(null)
  const [trocar, setTrocar] = useState<FiadoT | null>(null)
  const [desfazer, setDesfazer] = useState<FiadoT | null>(null)
  const [forma, setForma] = useState<FormaRecebimento>('pix')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const abertos = dados?.filter((f) => !f.pagoEm) ?? []
  const recebidos = (dados?.filter((f) => f.pagoEm) ?? []).sort((a, b) => b.pagoEm!.localeCompare(a.pagoEm!)).slice(0, 80)
  const totalAberto = abertos.reduce((s, f) => s + f.valor, 0)

  const porCliente = new Map<string, Devedor>()
  for (const f of abertos) {
    const g = porCliente.get(f.clienteId) ?? { clienteId: f.clienteId, nome: f.cliente, total: 0, fiados: [] }
    g.total += f.valor
    g.fiados.push(f)
    porCliente.set(f.clienteId, g)
  }
  const devedores = [...porCliente.values()]
    .map((g) => ({ ...g, fiados: [...g.fiados].sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.total - a.total)

  const porDiaPago = new Map<string, FiadoT[]>()
  for (const f of recebidos) porDiaPago.set(f.pagoEm!, [...(porDiaPago.get(f.pagoEm!) ?? []), f])

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
      setReceber(null)
      setTrocar(null)
      setDesfazer(null)
    }
  }
  const abrirReceber = (titulo: string, fiados: FiadoT[]) => {
    setForma('pix')
    setReceber({ titulo, fiados })
  }
  const valorReceber = receber?.fiados.reduce((s, f) => s + f.valor, 0) ?? 0

  return (
    <Pagina largura="max-w-3xl" comNav>
      <TituloSecao titulo="Fiado" sub="Vendas para pagar depois" />
      {(erro || erroCarga) && (
        <div className="mb-3">
          <Aviso>{erro ?? erroCarga}</Aviso>
        </div>
      )}

      {carregando && !dados ? (
        <Carregando />
      ) : (
        <div className="num space-y-4">
          <section className={`cartao flex flex-wrap items-end justify-between gap-3 p-5 ${totalAberto ? 'border-alerta/40' : ''}`}>
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
                ['abertos', `A receber (${abertos.length})`],
                ['recebidos', 'Recebidos'],
              ] as const
            ).map(([v, t]) => (
              <button key={v} type="button" role="tab" aria-selected={aba === v} className={`btn min-h-11 ${aba === v ? 'bg-destaque text-fundo' : 'text-sec'}`} onClick={() => setAba(v)}>
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
                  <div className="flex items-center justify-between gap-3 border-b border-borda px-4 py-3">
                    <Link to={`/clientes/${g.clienteId}`} className="min-w-0 hover:underline">
                      <h2 className="truncate text-lg font-bold">{g.nome}</h2>
                      <p className="text-sm text-sec">
                        {g.fiados.length} {g.fiados.length === 1 ? 'compra' : 'compras'} · desde {dataCurta(g.fiados[0].data)}
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xl font-extrabold text-alerta">{reais(g.total)}</span>
                      {g.fiados.length > 1 && (
                        <button type="button" className="btn-primario px-4" onClick={() => abrirReceber(`${g.nome} pagou tudo`, g.fiados)} disabled={!online || ocupado}>
                          Receber tudo
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="divide-y divide-borda/60">
                    {g.fiados.map((f) => (
                      <li key={f.pedidoId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <Link to={`/dia/${f.diaId}`} className="min-w-0 hover:underline">
                          <p className="truncate">{f.itens}</p>
                          <p className="text-sm text-sec">
                            {diaDaSemana(f.data).split('-')[0]}, {dataCurta(f.data)}
                          </p>
                        </Link>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-bold">{reais(f.valor)}</span>
                          <button
                            type="button"
                            className={`${g.fiados.length > 1 ? 'btn-secundario' : 'btn-primario'} px-4`}
                            onClick={() => abrirReceber(`${g.nome} pagou ${f.itens}`, [f])}
                            disabled={!online || ocupado}
                          >
                            Recebeu
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )
          ) : porDiaPago.size === 0 ? (
            <Vazio>Nenhum fiado recebido ainda.</Vazio>
          ) : (
            [...porDiaPago.entries()].map(([data, lista]) => (
              <section key={data} className="space-y-2">
                <h2 className="rotulo px-1">
                  Pago em {diaDaSemana(data).split('-')[0]}, {dataCurta(data)} · {reais(lista.reduce((s, f) => s + f.valor, 0))}
                </h2>
                <ul className="cartao divide-y divide-borda/60">
                  {lista.map((f) => (
                    <li key={f.pedidoId} className="flex items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{f.cliente}</p>
                        <p className="truncate text-sm text-sec">
                          {f.itens} · vendido em {dataCurta(f.data)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <div className="text-right">
                          <p className="font-bold">{reais(f.valor)}</p>
                          <Selo cor="positivo">{ROTULO_PAGAMENTO[f.pagoCom!]}</Selo>
                        </div>
                        <button
                          type="button"
                          className="grid size-11 place-items-center rounded-xl text-sec hover:bg-destaque/10 hover:text-claro"
                          onClick={() => {
                            setForma(f.pagoCom!)
                            setTrocar(f)
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
                          onClick={() => setDesfazer(f)}
                          disabled={!online || ocupado}
                          aria-label="Desfazer recebimento"
                          title="Desfazer recebimento"
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

      <Confirmar
        aberto={receber !== null}
        titulo={`${receber?.titulo ?? ''} · ${reais(valorReceber)}`}
        confirmar="Confirmar recebimento"
        ocupado={ocupado}
        onConfirmar={() => receber && executar(() => receberFiados(receber.fiados.map((f) => f.pedidoId), forma))}
        onCancelar={() => setReceber(null)}
      >
        {receber && (
          <div className="space-y-3">
            {receber.fiados.length > 1 && (
              <ul className="space-y-0.5">
                {receber.fiados.map((f) => (
                  <li key={f.pedidoId}>
                    {dataCurta(f.data)} · {f.itens} · {reais(f.valor)}
                  </li>
                ))}
              </ul>
            )}
            <p>O pagamento aparece no resumo do dia de cada venda.</p>
            <p className="rotulo">Pagou com</p>
            <Escolha nome="forma" opcoes={FORMAS_RECEBIMENTO} valor={forma} onChange={setForma} />
          </div>
        )}
      </Confirmar>

      <Confirmar
        aberto={trocar !== null}
        titulo={`Como ${trocar?.cliente} pagou?`}
        confirmar="Salvar"
        ocupado={ocupado}
        onConfirmar={() => trocar && executar(() => trocarFormaRecebimento(trocar.pedidoId, forma))}
        onCancelar={() => setTrocar(null)}
      >
        <Escolha nome="forma-troca" opcoes={FORMAS_RECEBIMENTO} valor={forma} onChange={setForma} />
      </Confirmar>

      <Confirmar
        aberto={desfazer !== null}
        titulo="Desfazer este recebimento?"
        confirmar="Desfazer"
        perigo
        ocupado={ocupado}
        onConfirmar={() => desfazer && executar(() => desfazerRecebimento(desfazer.pedidoId))}
        onCancelar={() => setDesfazer(null)}
      >
        A venda de {desfazer?.cliente} volta para "a receber".
      </Confirmar>
    </Pagina>
  )
}
