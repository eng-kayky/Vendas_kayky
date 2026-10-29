import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { carregarDiaPorId, finalizarDia, mensagemErro } from '../lib/api'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { calcularResumo } from '../lib/resumo'
import { useCarregar, useOnline } from '../hooks'
import { Aviso, Carregando, Icone, Pagina, Rodape, Topo } from '../components/ui'

export default function Finalizar() {
  const { diaId = '' } = useParams()
  const nav = useNavigate()
  const online = useOnline()
  const { dados, erro: erroCarga, carregando } = useCarregar(() => carregarDiaPorId(diaId), [diaId], 20000)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (carregando && !dados) return <Pagina><Topo titulo="Finalizar vendas" /><Carregando /></Pagina>
  if (!dados) return <Pagina><Topo titulo="Finalizar vendas" /><Aviso>{erroCarga ?? 'Dia não encontrado.'}</Aviso></Pagina>
  if (dados.dia.status === 'fechado') return <Navigate to={`/resultado/${diaId}`} replace />

  const r = calcularResumo(dados.itens, dados.vendas)
  const t = r.totais

  async function finalizar() {
    setErro(null)
    setEnviando(true)
    try {
      await finalizarDia(diaId)
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
        <section className="cartao border-positivo/30 bg-gradient-to-br from-[#0D2A2E] to-cartao p-5">
          <p className="rotulo text-positivo">Lucro do dia</p>
          <p className={`mt-1 text-5xl font-extrabold ${t.lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>{reais(t.lucro)}</p>
          <p className="mt-2 text-sec">Margem de {porcentagem(t.margem)} sobre o faturamento líquido</p>
        </section>

        <section className="cartao space-y-2 p-5">
          <Linha rotulo="Faturamento bruto" valor={reais(t.bruto)} />
          <Linha rotulo="Descontos dados" valor={reais(-t.descontos)} cor={t.descontos > 0 ? 'text-alerta' : ''} />
          <Linha rotulo="Faturamento líquido" valor={reais(t.liquido)} />
          <div className="border-t border-borda pt-2">
            <Linha rotulo="Custo da produção" valor={reais(-t.custo)} cor="text-alerta" />
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

        {t.sobra_unidades !== 0 && (
          <Aviso tipo="info">
            {t.sobra_unidades > 0
              ? `Sobraram ${t.sobra_unidades} unidades (${reais(t.sobra_custo)} em custo). Elas não passam para amanhã.`
              : `Foram vendidas ${-t.sobra_unidades} unidades acima do produzido.`}
          </Aviso>
        )}
        {dados.vendas.length === 0 && <Aviso>Nenhuma venda registrada neste dia.</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
      </div>

      <Rodape>
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={finalizar} disabled={enviando || !online}>
          <Icone nome="imagem" /> {enviando ? 'Finalizando…' : 'Finalizar e gerar imagem'}
        </button>
        <p className="mt-2 text-center text-xs text-sec">O dia fica bloqueado. Dá para reabrir pelo Histórico.</p>
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
