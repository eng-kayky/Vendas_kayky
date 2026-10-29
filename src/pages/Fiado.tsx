import { useState } from 'react'
import { desfazerRecebimento, listarFiados, mensagemErro, receberFiado, type Fiado as FiadoT } from '../lib/api'
import { dataCurta } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { FORMAS_RECEBIMENTO, type FormaRecebimento } from '../lib/resumo'
import { useCarregar, useOnline } from '../hooks'
import { Abas, Aviso, Carregando, Confirmar, Pagina, Topo } from '../components/ui'

const rotulo = Object.fromEntries(FORMAS_RECEBIMENTO.map((f) => [f.valor, f.rotulo])) as Record<FormaRecebimento, string>

export default function Fiado() {
  const online = useOnline()
  const { dados, erro: erroCarga, carregando, recarregar } = useCarregar(listarFiados, [], 30000)
  const [receber, setReceber] = useState<FiadoT | null>(null)
  const [forma, setForma] = useState<FormaRecebimento>('pix')
  const [desfazer, setDesfazer] = useState<FiadoT | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const abertos = dados?.filter((f) => !f.recebimento) ?? []
  const recebidos = dados?.filter((f) => f.recebimento).slice(0, 30) ?? []
  const totalAberto = abertos.reduce((s, f) => s + f.valor, 0)

  // Agrupa os abertos por cliente (sem diferenciar maiúsculas)
  const porCliente = new Map<string, { nome: string; total: number; vendas: FiadoT[] }>()
  for (const f of abertos) {
    const chave = f.cliente.toLocaleLowerCase('pt-BR')
    const g = porCliente.get(chave) ?? { nome: f.cliente, total: 0, vendas: [] }
    g.total += f.valor
    g.vendas.push(f)
    porCliente.set(chave, g)
  }
  const grupos = [...porCliente.values()].sort((a, b) => b.total - a.total)

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
    }
  }

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
          <section className="cartao p-5">
            <p className="rotulo">A receber</p>
            <p className={`mt-1 text-4xl font-extrabold ${totalAberto ? 'text-alerta' : ''}`}>{reais(totalAberto)}</p>
            <p className="mt-1 text-sm text-sec">
              {abertos.length} {abertos.length === 1 ? 'venda' : 'vendas'} · {grupos.length} {grupos.length === 1 ? 'cliente' : 'clientes'}
            </p>
          </section>

          {grupos.length === 0 && <p className="py-4 text-center text-sec">Ninguém devendo. 🎉</p>}

          {grupos.map((g) => (
            <section key={g.nome} className="cartao p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="truncate text-lg font-bold">{g.nome}</h2>
                <span className="shrink-0 font-bold text-alerta">{reais(g.total)}</span>
              </div>
              <ul className="divide-y divide-borda/60">
                {g.vendas.map((f) => (
                  <li key={f.venda_id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate">
                        {f.quantidade}× {f.produto}
                      </p>
                      <p className="text-sm text-sec">
                        {dataCurta(f.data)} · {reais(f.valor)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primario shrink-0 px-4"
                      onClick={() => {
                        setForma('pix')
                        setReceber(f)
                      }}
                      disabled={!online || ocupado}
                    >
                      Recebeu
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {recebidos.length > 0 && (
            <section className="space-y-2">
              <h2 className="rotulo pt-2">Recebidos recentemente</h2>
              <ul className="space-y-2">
                {recebidos.map((f) => (
                  <li key={f.venda_id} className="cartao flex items-center justify-between gap-3 px-4 py-3 opacity-80">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {f.cliente} · {f.quantidade}× {f.produto}
                      </p>
                      <p className="text-sm text-sec">
                        Vendido {dataCurta(f.data)} · recebido {dataCurta(f.recebimento!.data)} no {rotulo[f.recebimento!.pagamento]} ·{' '}
                        {reais(f.recebimento!.valor)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn min-h-11 shrink-0 px-3 text-sm text-sec hover:bg-alerta/10 hover:text-alerta"
                      onClick={() => setDesfazer(f)}
                      disabled={!online || ocupado}
                    >
                      Desfazer
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <Confirmar
        aberto={receber !== null}
        titulo={`${receber?.cliente} pagou ${receber ? reais(receber.valor) : ''}?`}
        confirmar="Confirmar recebimento"
        ocupado={ocupado}
        onConfirmar={() => receber && executar(() => receberFiado(receber, forma))}
        onCancelar={() => setReceber(null)}
      >
        {receber && (
          <div className="space-y-3">
            <p>
              {receber.quantidade}× {receber.produto}, vendido em {dataCurta(receber.data)}. O valor entra no caixa de hoje como fiado recebido.
            </p>
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
                    <input
                      type="radio"
                      name="forma"
                      className="sr-only"
                      checked={forma === p.valor}
                      onChange={() => setForma(p.valor)}
                    />
                    {p.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
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
