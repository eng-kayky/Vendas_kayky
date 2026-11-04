import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { diasDoPeriodo } from '../lib/api'
import { dataCurta, diaDaSemana, hojeBelem } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { agregarRelatorio, deslocar, nomePeriodo, periodoDe, type Periodo, type TipoPeriodo } from '../lib/calculos'
import { ROTULO_PAGAMENTO } from '../lib/tipos'
import { useCarregar } from '../hooks'
import { baixar, compartilharOuBaixar, gerarPng, ImagemRelatorio } from '../components/Imagens'
import { Aviso, Barra, Carregando, Icone, Pagina, TituloSecao, Vazio } from '../components/ui'

/** Relatório da semana ou do mês (dias fechados), com imagem para compartilhar. */
export default function Relatorio() {
  const hoje = hojeBelem()
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDe('semana', hoje))
  const { dados, erro, carregando } = useCarregar(() => diasDoPeriodo(periodo.inicio, periodo.fim), [periodo.inicio, periodo.fim])
  const [png, setPng] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const no = useRef<HTMLDivElement>(null)

  useEffect(() => setPng(null), [periodo.inicio, periodo.fim, dados])

  const r = dados ? agregarRelatorio(dados.fechados) : null
  const nomeArq = `relatorio-${periodo.tipo}-${periodo.inicio}.png`
  const maxDia = r ? Math.max(1, ...r.porDia.map((d) => d.faturamento)) : 1

  async function compartilhar() {
    if (!no.current) return
    setMsg(null)
    setGerando(true)
    try {
      const url = png ?? (await gerarPng(no.current))
      setPng(url)
      if (!(await compartilharOuBaixar([url], [nomeArq], `Relatório ${nomePeriodo(periodo)}`))) setMsg('Este aparelho não compartilha arquivos; a imagem foi baixada.')
    } catch {
      setMsg('Não foi possível gerar a imagem.')
    } finally {
      setGerando(false)
    }
  }

  const trocarTipo = (tipo: TipoPeriodo) => setPeriodo(periodoDe(tipo, periodo.tipo === tipo ? periodo.inicio : hoje))

  return (
    <Pagina largura="max-w-3xl" comNav>
      <TituloSecao titulo="Relatório" sub="Soma dos dias fechados no período" />

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl border border-borda bg-cartao p-1" role="tablist" aria-label="Período">
        {(['semana', 'mes'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={periodo.tipo === t} className={`btn min-h-11 ${periodo.tipo === t ? 'bg-destaque text-fundo' : 'text-sec'}`} onClick={() => trocarTipo(t)}>
            {t === 'semana' ? 'Semana' : 'Mês'}
          </button>
        ))}
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button type="button" className="btn-secundario size-11 p-0" onClick={() => setPeriodo(deslocar(periodo, -1))} aria-label="Período anterior">
          <Icone nome="voltar" />
        </button>
        <div className="text-center">
          <p className="text-lg font-bold">{nomePeriodo(periodo)}</p>
          {periodo.tipo === 'semana' && <p className="text-sm text-sec">segunda a domingo</p>}
        </div>
        <button
          type="button"
          className="btn-secundario size-11 p-0"
          onClick={() => setPeriodo(deslocar(periodo, 1))}
          disabled={deslocar(periodo, 1).inicio > hoje}
          aria-label="Próximo período"
        >
          <Icone nome="avancar" />
        </button>
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {carregando && !dados ? (
        <Carregando />
      ) : !r ? null : (
        <div className="num space-y-3">
          {dados!.abertos.length > 0 && (
            <Aviso>
              Dia(s) ainda aberto(s), fora do relatório:{' '}
              {dados!.abertos.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ', '}
                  <Link to={d.data === hoje ? '/' : `/dia/${d.id}`} className="font-bold underline">
                    {dataCurta(d.data)}
                  </Link>
                </span>
              ))}
              .
            </Aviso>
          )}

          {r.dias === 0 ? (
            <Vazio>Nenhum dia fechado neste período.</Vazio>
          ) : (
            <>
              <section className={`cartao p-5 ${r.lucro < 0 ? 'border-alerta/40' : 'border-positivo/30 bg-gradient-to-br from-[#0D2A2E] to-cartao'}`}>
                <p className={`rotulo ${r.lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>Lucro do período</p>
                <p className={`mt-1 text-4xl font-extrabold ${r.lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>{reais(r.lucro)}</p>
                <p className="mt-1 text-sm text-sec">
                  Margem {porcentagem(r.margem)} · {r.dias} {r.dias === 1 ? 'dia trabalhado' : 'dias trabalhados'}
                </p>
              </section>

              <div className="grid grid-cols-2 gap-3">
                <Caixa titulo="Faturamento" valor={reais(r.faturamento)} sub={`${r.unidades} itens vendidos`} />
                <Caixa titulo="Recebido" valor={reais(r.recebido)} sub="inclui fiado pago" />
                <Caixa titulo="Fiado a receber" valor={reais(r.aReceber)} sub="vendido nestes dias" cor={r.aReceber ? 'text-alerta' : ''} />
                <Caixa titulo="Gasto com material" valor={reais(r.gasto)} sub={r.diasSemGasto ? `${r.diasSemGasto} dia(s) sem gasto` : 'todos os dias com gasto'} />
                <Caixa titulo="Vendas" valor={String(r.vendas)} sub={r.ticketMedio ? `ticket médio ${reais(r.ticketMedio)}` : '—'} />
                <Caixa titulo="Descontos" valor={reais(r.descontos)} sub={r.bruto ? `${porcentagem(r.descontos / r.bruto)} do bruto` : '—'} />
              </div>

              <section className="cartao space-y-1.5 p-4">
                <p className="rotulo mb-1">Por forma de pagamento</p>
                {(['pix', 'dinheiro', 'cartao', 'fiado', 'nao_informado'] as const)
                  .filter((k) => k !== 'nao_informado' || r.porForma[k] > 0)
                  .map((k) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-sec">{ROTULO_PAGAMENTO[k]}</span>
                      <span className="font-bold">{reais(r.porForma[k])}</span>
                    </div>
                  ))}
              </section>

              <section className="cartao p-4">
                <h2 className="mb-2 text-lg font-bold">Por produto</h2>
                <ul className="divide-y divide-borda/60">
                  {r.produtos.map((p) => (
                    <li key={p.nome} className="flex justify-between gap-3 py-2">
                      <span className="min-w-0 truncate">{p.nome}</span>
                      <span className="shrink-0">
                        <span className="text-sec">
                          {p.vendido} {p.unidade} ·{' '}
                        </span>
                        <strong>{reais(p.faturado)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="cartao p-4">
                <h2 className="mb-1 text-lg font-bold">Por dia</h2>
                {r.melhorDia && (
                  <p className="mb-3 text-sm text-sec">
                    Melhor dia: {diaDaSemana(r.melhorDia.data)}, {dataCurta(r.melhorDia.data)} ({reais(r.melhorDia.faturamento)})
                  </p>
                )}
                <ul className="space-y-2">
                  {r.porDia.map((d) => (
                    <li key={d.data} className="text-sm">
                      <div className="flex justify-between">
                        <span>
                          {dataCurta(d.data).slice(0, 5)} <span className="text-sec">{diaDaSemana(d.data).split('-')[0]}</span>
                        </span>
                        <span className="font-bold">
                          {reais(d.faturamento)} <span className={`font-normal ${d.lucro < 0 ? 'text-alerta' : 'text-sec'}`}>· lucro {reais(d.lucro)}</span>
                        </span>
                      </div>
                      <div className="mt-1">
                        <Barra valor={d.faturamento} total={maxDia} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {r.clientes.length > 0 && (
                <section className="cartao p-4">
                  <h2 className="mb-2 text-lg font-bold">Clientes que mais compraram</h2>
                  <ol className="divide-y divide-borda/60">
                    {r.clientes.map((c, i) => (
                      <li key={c.nome} className="flex justify-between gap-3 py-2">
                        <span className="min-w-0 truncate">
                          <span className="text-sec">{i + 1}.</span> {c.nome}
                        </span>
                        <span className="shrink-0 font-bold">
                          {reais(c.total)} <span className="font-normal text-sec">· {c.compras}×</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {msg && <Aviso tipo="info">{msg}</Aviso>}
              <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={compartilhar} disabled={gerando}>
                <Icone nome="compartilhar" /> {gerando ? 'Gerando imagem…' : 'Compartilhar imagem do relatório'}
              </button>
              {png && (
                <button type="button" className="btn-secundario min-h-12 w-full" onClick={() => baixar([png], [nomeArq])}>
                  <Icone nome="baixar" /> Baixar PNG
                </button>
              )}
              <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}>
                <ImagemRelatorio ref={no} r={r} periodo={periodo} />
              </div>
            </>
          )}
        </div>
      )}
    </Pagina>
  )
}

function Caixa({ titulo, valor, sub, cor = '' }: { titulo: string; valor: string; sub: string; cor?: string }) {
  return (
    <div className="cartao p-4">
      <p className={`rotulo ${cor}`}>{titulo}</p>
      <p className={`mt-1 text-2xl font-extrabold ${cor}`}>{valor}</p>
      <p className="mt-1 text-xs text-sec">{sub}</p>
    </div>
  )
}
