import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { carregarDiaPorId, mensagemErro, reabrirDia, situacaoFiados, telaDoDia } from '../lib/api'
import { dataCurta, dataLonga, hora } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { imagemDoSnapshot, listarVendasDoDia, PAGAMENTOS } from '../lib/resumo'

const rotuloPg = Object.fromEntries(PAGAMENTOS.map((p) => [p.valor, p.rotulo])) as Record<string, string>
import { useCarregar, useOnline } from '../hooks'
import { Aviso, Carregando, Confirmar, Icone, Pagina, Topo } from '../components/ui'

export default function HistoricoDia() {
  const { diaId = '' } = useParams()
  const nav = useNavigate()
  const online = useOnline()
  const { dados, erro: erroCarga, carregando } = useCarregar(async () => {
    const d = await carregarDiaPorId(diaId)
    if (!d) return null
    // Dias fechados antes desta versão não têm a lista no resumo: monta com as vendas gravadas
    const lista = d.dia.snapshot?.vendas_lista?.length
      ? d.dia.snapshot.vendas_lista.map((v) => ({ ...v, valor: Math.round(v.valor * 100) }))
      : listarVendasDoDia(d.itens, d.vendas)
    const situacao = await situacaoFiados(lista.filter((v) => v.pagamento === 'fiado').map((v) => v.venda_id))
    return { ...d, lista, situacao }
  }, [diaId])
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
        <Link to={telaDoDia(dia)} className="btn-primario mt-4 min-h-12 w-full">
          Abrir o dia
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
      nav(telaDoDia(dia), { replace: true })
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
          <L r="Pix" v={reais(d.pagamentos.pix)} />
          <L r="Dinheiro" v={reais(d.pagamentos.dinheiro)} />
          <L r="Cartão" v={reais(d.pagamentos.cartao)} />
          {d.pagamentos.fiado > 0 && <L r="Vendido fiado" v={reais(d.pagamentos.fiado)} />}
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

        {dados.lista.length > 0 && (
          <section className="cartao p-4">
            <h2 className="mb-2 text-lg font-bold">Vendas do dia ({dados.lista.length})</h2>
            <ul className="divide-y divide-borda/60">
              {dados.lista.map((v) => {
                const s = dados.situacao[v.venda_id]
                return (
                  <li key={v.venda_id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{v.cliente ?? 'Sem nome'}</p>
                      <p className="text-sm text-sec">
                        {hora(v.hora)} · {v.quantidade}× {v.produto}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold">{reais(v.valor)}</p>
                      <p className={`text-sm ${v.pagamento === 'fiado' ? (s ? 'text-positivo' : 'text-alerta') : 'text-sec'}`}>
                        {v.pagamento === 'fiado'
                          ? s
                            ? `Fiado · pago ${rotuloPg[s.pagamento]} ${dataCurta(s.data).slice(0, 5)}`
                            : 'Fiado · a receber'
                          : rotuloPg[v.pagamento]}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {erro && <Aviso>{erro}</Aviso>}

        <Link to={`/resultado/${dia.id}`} className="btn-primario min-h-14 w-full text-lg">
          <Icone nome="imagem" /> Gerar imagem de novo
        </Link>
        {d.resumido ? (
          <Link to={`/lancar/${dia.id}`} className="btn-secundario min-h-12 w-full">
            <Icone nome="lapis" tamanho={18} /> Editar lançamento
          </Link>
        ) : (
          <button type="button" className="btn-secundario min-h-12 w-full" onClick={() => setConfirmar(true)} disabled={!online}>
            <Icone nome="lapis" tamanho={18} /> Editar vendas deste dia
          </button>
        )}
      </div>

      <Confirmar
        aberto={confirmar}
        titulo={`Editar as vendas de ${dataCurta(dia.data)}?`}
        confirmar="Reabrir e editar"
        ocupado={ocupado}
        onConfirmar={reabrir}
        onCancelar={() => setConfirmar(false)}
      >
        O dia é reaberto para você corrigir, incluir ou desfazer vendas. Depois toque em Finalizar vendas de novo (com o gasto do dia) para gerar o
        resumo atualizado.
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
