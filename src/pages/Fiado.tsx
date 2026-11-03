import { useState } from 'react'
import { alterarRecebimento, desfazerRecebimento, listarFiados, mensagemErro, receberFiado, type Fiado as FiadoT } from '../lib/api'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { FORMAS_RECEBIMENTO, type FormaRecebimento } from '../lib/resumo'
import { useCarregar, useOnline } from '../hooks'
import { Abas, Aviso, Carregando, Confirmar, Icone, Pagina, Topo } from '../components/ui'

const rotulo = Object.fromEntries(FORMAS_RECEBIMENTO.map((f) => [f.valor, f.rotulo])) as Record<FormaRecebimento, string>

interface Cliente {
  nome: string
  total: number
  vendas: FiadoT[]
}

/** O que vai ser recebido: uma venda ou todas as de um cliente. */
interface Recebimento {
  titulo: string
  vendas: FiadoT[]
}

export default function Fiado() {
  const online = useOnline()
  const { dados, erro: erroCarga, carregando, recarregar } = useCarregar(listarFiados, [], 30000)
  const [aba, setAba] = useState<'abertos' | 'recebidos'>('abertos')
  const [receber, setReceber] = useState<Recebimento | null>(null)
  const [forma, setForma] = useState<FormaRecebimento>('pix')
  const [desfazer, setDesfazer] = useState<FiadoT | null>(null)
  const [trocar, setTrocar] = useState<FiadoT | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const abertos = dados?.filter((f) => !f.recebimento) ?? []
  const recebidos = (dados?.filter((f) => f.recebimento) ?? [])
    .sort((a, b) => b.recebimento!.data.localeCompare(a.recebimento!.data))
    .slice(0, 60)
  const totalAberto = abertos.reduce((s, f) => s + f.valor, 0)

  // A receber, por cliente (sem diferenciar maiúsculas), quem deve mais primeiro
  const porCliente = new Map<string, Cliente>()
  for (const f of abertos) {
    const chave = f.cliente.toLocaleLowerCase('pt-BR')
    const g = porCliente.get(chave) ?? { nome: f.cliente, total: 0, vendas: [] }
    g.total += f.valor
    g.vendas.push(f)
    porCliente.set(chave, g)
  }
  const clientes = [...porCliente.values()]
    .map((c) => ({ ...c, vendas: [...c.vendas].sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.total - a.total)

  // Recebidos, agrupados pelo dia em que o cliente pagou
  const porDiaPago = new Map<string, FiadoT[]>()
  for (const f of recebidos) porDiaPago.set(f.recebimento!.data, [...(porDiaPago.get(f.recebimento!.data) ?? []), f])

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
      setDesfazer(null)
      setTrocar(null)
    }
  }

  const abrirRecebimento = (r: Recebimento) => {
    setForma('pix')
    setReceber(r)
  }
  const valorReceber = receber?.vendas.reduce((s, f) => s + f.valor, 0) ?? 0

  return (
    <Pagina largura="max-w-3xl">
      <div className="md:hidden">
        <Topo titulo="Fiado" />
      </div>
      <div className="hidden pb-5 pt-6 md:block">
        <h1 className="mb-4 text-3xl font-extrabold">Fiado</h1>
        <Abas />
      </div>

      {(erro || erroCarga) && (
        <div className="mb-3">
          <Aviso>{erro ?? erroCarga}</Aviso>
        </div>
      )}

      {carregando && !dados ? (
        <Carregando />
      ) : (
        <div className="num space-y-4">
          {/* total */}
          <section className={`cartao flex flex-wrap items-end justify-between gap-3 p-5 ${totalAberto ? 'border-alerta/40' : ''}`}>
            <div>
              <p className={`rotulo ${totalAberto ? 'text-alerta' : ''}`}>Total a receber</p>
              <p className={`mt-1 text-4xl font-extrabold ${totalAberto ? 'text-alerta' : ''}`}>{reais(totalAberto)}</p>
            </div>
            <p className="text-sm text-sec">
              {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} · {abertos.length}{' '}
              {abertos.length === 1 ? 'venda' : 'vendas'}
            </p>
          </section>

          {/* abas */}
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-borda bg-cartao p-1" role="tablist">
            {(
              [
                ['abertos', `A receber (${abertos.length})`],
                ['recebidos', 'Recebidos'],
              ] as const
            ).map(([v, t]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={aba === v}
                className={`btn min-h-11 ${aba === v ? 'bg-destaque text-fundo' : 'text-sec'}`}
                onClick={() => setAba(v)}
              >
                {t}
              </button>
            ))}
          </div>

          {aba === 'abertos' ? (
            clientes.length === 0 ? (
              <p className="py-8 text-center text-sec">Ninguém devendo. 🎉</p>
            ) : (
              clientes.map((c) => (
                <section key={c.nome} className="cartao overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-borda px-4 py-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">{c.nome}</h2>
                      <p className="text-sm text-sec">
                        {c.vendas.length} {c.vendas.length === 1 ? 'compra' : 'compras'} · desde {dataCurta(c.vendas[0].data)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xl font-extrabold text-alerta">{reais(c.total)}</span>
                      {c.vendas.length > 1 && (
                        <button
                          type="button"
                          className="btn-primario px-4"
                          onClick={() => abrirRecebimento({ titulo: `${c.nome} pagou tudo`, vendas: c.vendas })}
                          disabled={!online || ocupado}
                        >
                          Receber tudo
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="divide-y divide-borda/60">
                    {c.vendas.map((f) => (
                      <li key={f.venda_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate">
                            {f.quantidade}× {f.produto}
                          </p>
                          <p className="text-sm text-sec">
                            {diaDaSemana(f.data).split('-')[0]}, {dataCurta(f.data)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-bold">{reais(f.valor)}</span>
                          <button
                            type="button"
                            className={`${c.vendas.length > 1 ? 'btn-secundario' : 'btn-primario'} px-4`}
                            onClick={() =>
                              abrirRecebimento({ titulo: `${c.nome} pagou ${f.quantidade}× ${f.produto}`, vendas: [f] })
                            }
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
            <p className="py-8 text-center text-sec">Nenhum fiado recebido ainda.</p>
          ) : (
            [...porDiaPago.entries()].map(([data, lista]) => (
              <section key={data} className="space-y-2">
                <h2 className="rotulo px-1">
                  Pago em {diaDaSemana(data).split('-')[0]}, {dataCurta(data)} · {reais(lista.reduce((s, f) => s + f.valor, 0))}
                </h2>
                <ul className="cartao divide-y divide-borda/60">
                  {lista.map((f) => (
                    <li key={f.venda_id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{f.cliente}</p>
                        <p className="text-sm text-sec">
                          {f.quantidade}× {f.produto} · vendido em {dataCurta(f.data)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold">{reais(f.valor)}</p>
                          <span className="inline-block rounded-full bg-positivo/15 px-2 py-0.5 text-xs font-semibold text-positivo">
                            {rotulo[f.recebimento!.pagamento]}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="grid size-11 place-items-center rounded-xl text-sec hover:bg-destaque/10 hover:text-claro"
                          onClick={() => {
                            setForma(f.recebimento!.pagamento)
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
        onConfirmar={() => receber && executar(async () => { for (const f of receber.vendas) await receberFiado(f, forma) })}
        onCancelar={() => setReceber(null)}
      >
        {receber && (
          <div className="space-y-3">
            {receber.vendas.length > 1 && (
              <ul className="space-y-0.5">
                {receber.vendas.map((f) => (
                  <li key={f.venda_id}>
                    {dataCurta(f.data)} · {f.quantidade}× {f.produto} · {reais(f.valor)}
                  </li>
                ))}
              </ul>
            )}
            <p>O pagamento aparece no resumo do dia de cada venda.</p>
            <FormaEscolha forma={forma} setForma={setForma} nome="forma" />
          </div>
        )}
      </Confirmar>

      <Confirmar
        aberto={trocar !== null}
        titulo={`Como ${trocar?.cliente} pagou?`}
        confirmar="Salvar"
        ocupado={ocupado}
        onConfirmar={() => trocar?.recebimento && executar(() => alterarRecebimento(trocar.recebimento!.id, forma))}
        onCancelar={() => setTrocar(null)}
      >
        <FormaEscolha forma={forma} setForma={setForma} nome="forma-troca" />
      </Confirmar>

      <Confirmar
        aberto={desfazer !== null}
        titulo="Desfazer este recebimento?"
        confirmar="Desfazer"
        perigo
        ocupado={ocupado}
        onConfirmar={() => desfazer?.recebimento && executar(() => desfazerRecebimento(desfazer.recebimento!.id))}
        onCancelar={() => setDesfazer(null)}
      >
        A venda de {desfazer?.cliente} volta para "a receber".
      </Confirmar>
    </Pagina>
  )
}

function FormaEscolha({ forma, setForma, nome }: { forma: FormaRecebimento; setForma: (f: FormaRecebimento) => void; nome: string }) {
  return (
    <fieldset>
      <legend className="rotulo mb-2">Pagou com</legend>
      <div className="grid grid-cols-3 gap-2">
        {FORMAS_RECEBIMENTO.map((p) => (
          <label
            key={p.valor}
            className={`btn min-h-11 cursor-pointer border text-sm ${
              forma === p.valor ? 'border-destaque bg-destaque text-fundo' : 'border-borda text-texto'
            }`}
          >
            <input type="radio" name={nome} className="sr-only" checked={forma === p.valor} onChange={() => setForma(p.valor)} />
            {p.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
