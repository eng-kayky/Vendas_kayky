import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { carregarDiaPorId, mensagemErro, reabrirDia } from '../lib/api'
import { dataCurta, dataLonga, hojeBelem } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { imagemDoSnapshot } from '../lib/resumo'
import { useCarregar, useOnline } from '../hooks'
import { Aviso, Carregando, Confirmar, Icone, Pagina, Topo } from '../components/ui'

export default function HistoricoDia() {
  const { diaId = '' } = useParams()
  const nav = useNavigate()
  const online = useOnline()
  const { dados, erro: erroCarga, carregando } = useCarregar(() => carregarDiaPorId(diaId), [diaId])
  const [confirmar, setConfirmar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (carregando && !dados) return <Pagina><Topo titulo="Dia" voltar="/historico" /><Carregando /></Pagina>
  if (!dados) return <Pagina><Topo titulo="Dia" voltar="/historico" /><Aviso>{erroCarga ?? 'Dia não encontrado.'}</Aviso></Pagina>

  const { dia } = dados
  if (!dia.snapshot) {
    return (
      <Pagina>
        <Topo titulo={dataCurta(dia.data)} voltar="/historico" />
        <Aviso tipo="info">Este dia está aberto.</Aviso>
        <Link to={`/finalizar/${dia.id}`} className="btn-primario mt-4 min-h-12 w-full">
          Finalizar vendas
        </Link>
      </Pagina>
    )
  }

  const d = imagemDoSnapshot(dia.snapshot)

  async function reabrir() {
    setOcupado(true)
    setErro(null)
    try {
      await reabrirDia(dia.id)
      nav(dia.data === hojeBelem() ? '/' : `/finalizar/${dia.id}`, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setOcupado(false)
      setConfirmar(false)
    }
  }

  return (
    <Pagina>
      <Topo titulo={dataCurta(dia.data)} sub={dataLonga(dia.data)} voltar="/historico" />
      <div className="num space-y-3">
        <section className="cartao border-positivo/30 bg-gradient-to-br from-[#0D2A2E] to-cartao p-5">
          <p className="rotulo text-positivo">Lucro do dia</p>
          <p className={`mt-1 text-4xl font-extrabold ${d.lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>{reais(d.lucro)}</p>
          <p className="mt-1 text-sec">Margem de {porcentagem(d.margem)}</p>
        </section>

        <section className="cartao space-y-2 p-5">
          <L r="Faturamento bruto" v={reais(d.bruto)} />
          <L r="Descontos" v={reais(-d.descontos)} />
          <L r="Faturamento líquido" v={reais(d.liquido)} />
          <L r="Gasto com material" v={d.gasto === null ? 'Não teve (N/A)' : reais(-d.gasto)} />
          <L r="Pix · Dinheiro · Cartão" v={`${reais(d.pagamentos.pix)} · ${reais(d.pagamentos.dinheiro)} · ${reais(d.pagamentos.cartao)}`} />
          <L r="Sobra" v={`${d.sobra_unidades} unidades`} />
        </section>

        <section className="cartao overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="rotulo text-left">
                <th className="py-2 font-semibold">Produto</th>
                <th className="py-2 text-right font-semibold">Vend.</th>
                <th className="py-2 text-right font-semibold">Faturado</th>
              </tr>
            </thead>
            <tbody>
              {d.itens.map((i) => (
                <tr key={i.nome} className="border-t border-borda/60">
                  <td className="py-2">{i.nome}</td>
                  <td className="py-2 text-right">
                    {i.vendido}/{i.produzido}
                  </td>
                  <td className="py-2 text-right font-bold">{reais(i.faturado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {erro && <Aviso>{erro}</Aviso>}

        <Link to={`/resultado/${dia.id}`} className="btn-primario min-h-14 w-full text-lg">
          <Icone nome="imagem" /> Gerar imagem de novo
        </Link>
        <button type="button" className="btn-perigo min-h-12 w-full" onClick={() => setConfirmar(true)} disabled={!online}>
          Reabrir dia
        </button>
      </div>

      <Confirmar
        aberto={confirmar}
        titulo={`Reabrir o dia ${dataCurta(dia.data)}?`}
        confirmar="Reabrir dia"
        perigo
        ocupado={ocupado}
        onConfirmar={reabrir}
        onCancelar={() => setConfirmar(false)}
      >
        O resumo gravado será descartado e o dia volta a aceitar vendas e alterações. Ao finalizar de novo, uma nova imagem é gerada.
      </Confirmar>
    </Pagina>
  )
}

function L({ r, v }: { r: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-sec">{r}</span>
      <span className="text-right font-bold">{v}</span>
    </div>
  )
}
