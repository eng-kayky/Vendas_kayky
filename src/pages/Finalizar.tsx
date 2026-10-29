import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { carregarDiaPorId, finalizarDia, mensagemErro } from '../lib/api'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { lerReais, porcentagem, reais } from '../lib/dinheiro'
import { calcularLucro, calcularResumo } from '../lib/resumo'
import { useCarregar, useOnline } from '../hooks'
import { Aviso, Carregando, Icone, Pagina, Rodape, Topo } from '../components/ui'

export default function Finalizar() {
  const { diaId = '' } = useParams()
  const nav = useNavigate()
  const online = useOnline()
  const { dados, erro: erroCarga, carregando } = useCarregar(() => carregarDiaPorId(diaId), [diaId], 20000)
  const [gastoTexto, setGastoTexto] = useState('')
  const [semGasto, setSemGasto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (carregando && !dados) return <Pagina><Topo titulo="Finalizar vendas" /><Carregando /></Pagina>
  if (!dados) return <Pagina><Topo titulo="Finalizar vendas" /><Aviso>{erroCarga ?? 'Dia não encontrado.'}</Aviso></Pagina>
  if (dados.dia.status === 'fechado') return <Navigate to={`/resultado/${diaId}`} replace />

  const r = calcularResumo(dados.itens, dados.vendas)
  const t = r.totais
  const gastoLido = lerReais(gastoTexto)
  const gasto = semGasto ? null : gastoLido
  const gastoValido = semGasto || gastoLido !== null
  const { lucro, margem } = calcularLucro(t.liquido, gasto)

  async function finalizar() {
    if (!gastoValido) return setErro('Informe o gasto com material ou marque "Não teve gasto".')
    setErro(null)
    setEnviando(true)
    try {
      await finalizarDia(diaId, gasto)
      nav(`/resultado/${diaId}`, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
    }
  }

  return (
    <Pagina>
      <Topo titulo="Finalizar vendas" sub={`${diaDaSemana(dados.dia.data)}, ${dataCurta(dados.dia.data)}`} />
      <div className="num space-y-3">
        <section className="cartao p-5">
          <p className="rotulo">Faturamento líquido</p>
          <p className="mt-1 text-5xl font-extrabold">{reais(t.liquido)}</p>
          <p className="mt-2 text-sec">
            {t.vendas} {t.vendas === 1 ? 'venda' : 'vendas'} · {t.vendido} unidades
          </p>
        </section>

        <section className="cartao space-y-2 p-5">
          <Linha rotulo="Faturamento bruto" valor={reais(t.bruto)} />
          <Linha rotulo="Descontos dados" valor={reais(-t.descontos)} cor={t.descontos > 0 ? 'text-alerta' : ''} />
          <div className="border-t border-borda pt-2">
            <Linha rotulo="Faturamento líquido" valor={reais(t.liquido)} />
          </div>
        </section>

        <section className="cartao grid grid-cols-3 divide-x divide-borda py-4 text-center">
          {(
            [
              ['Pix', r.pagamentos.pix],
              ['Dinheiro', r.pagamentos.dinheiro],
              ['Cartão', r.pagamentos.cartao],
            ] as const
          ).map(([rotulo, v]) => (
            <div key={rotulo} className="px-1">
              <p className="rotulo">{rotulo}</p>
              <p className="mt-1 text-lg font-bold">{reais(v)}</p>
            </div>
          ))}
        </section>

        {/* Gasto com material: informado só aqui, no fechamento */}
        <section className="cartao space-y-3 p-5">
          <label htmlFor="gasto" className="rotulo block">
            Gasto com material hoje
          </label>
          <div
            className={`flex min-h-14 items-center gap-2 rounded-xl border bg-fundo/60 px-4 ${
              semGasto ? 'border-borda opacity-40' : 'border-destaque focus-within:ring-2 focus-within:ring-destaque/30'
            }`}
          >
            <span className="text-lg text-sec">R$</span>
            <input
              id="gasto"
              className="w-full bg-transparent text-2xl font-extrabold outline-none"
              inputMode="decimal"
              placeholder="0,00"
              value={gastoTexto}
              disabled={semGasto}
              onChange={(e) => setGastoTexto(e.target.value)}
              aria-invalid={!semGasto && gastoTexto !== '' && gastoLido === null}
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-[#4B8DFF]"
              checked={semGasto}
              onChange={(e) => setSemGasto(e.target.checked)}
            />
            <span>
              Não teve gasto <span className="text-sec">(N/A, usei material que já tinha)</span>
            </span>
          </label>
          {!semGasto && gastoTexto !== '' && gastoLido === null && <p className="text-sm text-alerta">Valor inválido.</p>}
        </section>

        {gastoValido && (
          <section
            className={`cartao p-5 ${lucro < 0 ? 'border-alerta/40' : 'border-positivo/30 bg-gradient-to-br from-[#0D2A2E] to-cartao'}`}
          >
            <p className={`rotulo ${lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>Lucro do dia</p>
            <p className={`mt-1 text-4xl font-extrabold ${lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>{reais(lucro)}</p>
            <p className="mt-1 text-sm text-sec">
              {semGasto ? 'Sem gasto com material' : `Líquido − gasto de ${reais(gasto ?? 0)}`} · margem {porcentagem(margem)}
            </p>
          </section>
        )}

        {t.sobra_unidades !== 0 && (
          <Aviso tipo="info">
            {t.sobra_unidades > 0
              ? `Sobraram ${t.sobra_unidades} unidades. Elas não passam para amanhã.`
              : `Foram vendidas ${-t.sobra_unidades} unidades acima do produzido.`}
          </Aviso>
        )}
        {dados.vendas.length === 0 && <Aviso>Nenhuma venda registrada neste dia.</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
      </div>

      <Rodape>
        <button
          type="button"
          className="btn-primario min-h-14 w-full text-lg"
          onClick={finalizar}
          disabled={enviando || !online || !gastoValido}
        >
          <Icone nome="imagem" /> {enviando ? 'Finalizando…' : 'Finalizar e gerar imagem'}
        </button>
        <p className="mt-2 text-center text-xs text-sec">
          {gastoValido ? 'O dia fica bloqueado. Dá para reabrir pelo Histórico.' : 'Informe o gasto ou marque "Não teve gasto".'}
        </p>
      </Rodape>
    </Pagina>
  )
}

function Linha({ rotulo, valor, cor = '' }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sec">{rotulo}</span>
      <span className={`font-bold ${cor}`}>{valor}</span>
    </div>
  )
}
