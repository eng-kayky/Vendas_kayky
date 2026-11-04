import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { carregarDia, fecharDia, mensagemErro } from '../lib/api'
import { dataCurta, diaDaSemana, hojeBelem } from '../lib/datas'
import { lerReais, numeroBR, porcentagem, reais } from '../lib/dinheiro'
import { resumirDia } from '../lib/calculos'
import { ROTULO_PAGAMENTO } from '../lib/tipos'
import { useCarregar, useOnline } from '../hooks'
import { Aviso, Carregando, Icone, Pagina, Rodape, Topo } from '../components/ui'

/** Fechar o dia: confere os valores, informa o gasto com material (ou N/A) e bloqueia o dia. */
export default function FecharDia() {
  const { diaId = '' } = useParams()
  const nav = useNavigate()
  const online = useOnline()
  const { dados: d, erro: erroCarga, carregando } = useCarregar(() => carregarDia(diaId), [diaId])
  const [gastoTexto, setGastoTexto] = useState('')
  const [semGasto, setSemGasto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Dia reaberto: o gasto informado antes vem preenchido
  useEffect(() => {
    if (!d) return
    if (d.dia.semGasto) setSemGasto(true)
    else if (d.dia.gasto !== null) setGastoTexto(numeroBR(d.dia.gasto))
  }, [d?.dia.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (carregando && !d) return <Pagina><Topo titulo="Fechar o dia" voltar={-1} /><Carregando /></Pagina>
  if (!d) return <Pagina><Topo titulo="Fechar o dia" voltar={-1} /><Aviso>{erroCarga ?? 'Dia não encontrado.'}</Aviso></Pagina>
  if (d.dia.status === 'fechado') return <Navigate to={`/dia/${diaId}/imagem`} replace />

  const voltar = d.dia.data === hojeBelem() ? '/' : `/dia/${d.dia.id}`
  const r = resumirDia({ ...d, dia: { ...d.dia, gasto: semGasto ? null : lerReais(gastoTexto), semGasto } })
  const gastoLido = lerReais(gastoTexto)
  const gastoValido = semGasto || gastoLido !== null
  const reservas = d.pedidos.filter((p) => p.status === 'reservado').length

  async function fechar() {
    if (!gastoValido) return setErro('Informe o gasto com material ou marque "Não teve gasto".')
    if (reservas) return setErro('Entregue ou cancele as reservas antes de fechar.')
    setErro(null)
    setEnviando(true)
    try {
      await fecharDia(diaId, semGasto ? null : gastoLido)
      nav(`/dia/${diaId}/imagem`, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setEnviando(false)
    }
  }

  return (
    <Pagina>
      <Topo titulo="Fechar o dia" sub={`${diaDaSemana(d.dia.data)}, ${dataCurta(d.dia.data)}`} voltar={voltar} />
      <div className="num space-y-3">
        <section className="cartao p-5">
          <p className="rotulo">Faturamento do dia</p>
          <p className="mt-1 text-5xl font-extrabold">{reais(r.faturamento)}</p>
          <p className="mt-2 text-sec">
            {r.vendas} {r.vendas === 1 ? 'venda' : 'vendas'} · {r.unidades} itens{r.descontos ? ` · descontos ${reais(r.descontos)}` : ''}
          </p>
        </section>

        <section className="cartao space-y-1.5 p-4">
          {(['pix', 'dinheiro', 'cartao', 'fiado', 'nao_informado'] as const)
            .filter((k) => k !== 'nao_informado' || r.porForma[k] > 0)
            .map((k) => (
              <div key={k} className="flex justify-between">
                <span className="text-sec">{ROTULO_PAGAMENTO[k]}</span>
                <span className={`font-bold ${k === 'fiado' && r.aReceber ? 'text-alerta' : ''}`}>{reais(r.porForma[k])}</span>
              </div>
            ))}
          {r.porForma.fiado > 0 && (
            <p className="pt-1 text-xs text-sec">
              Fiado: {reais(r.aReceber)} ainda a receber{r.fiadoPago ? `, ${reais(r.fiadoPago)} já pago` : ''}. Quem pagar depois aparece no resumo deste dia.
            </p>
          )}
        </section>

        {reservas > 0 && (
          <Aviso>
            Há {reservas} {reservas === 1 ? 'reserva' : 'reservas'} em aberto. Entregue ou cancele na{' '}
            <Link to={voltar} className="font-bold underline">
              tela do dia
            </Link>{' '}
            antes de fechar.
          </Aviso>
        )}

        <section className="cartao space-y-3 p-5">
          <label htmlFor="gasto" className="rotulo block">
            Gasto com material neste dia
          </label>
          <div className={`flex min-h-14 items-center gap-2 rounded-xl border bg-fundo/60 px-4 ${semGasto ? 'border-borda opacity-40' : 'border-destaque'}`}>
            <span className="text-lg text-sec">R$</span>
            <input
              id="gasto"
              className="w-full bg-transparent text-2xl font-extrabold outline-none"
              inputMode="decimal"
              placeholder="0,00"
              value={gastoTexto}
              disabled={semGasto}
              onChange={(e) => setGastoTexto(e.target.value)}
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" className="size-5 accent-[#4B8DFF]" checked={semGasto} onChange={(e) => setSemGasto(e.target.checked)} />
            <span>
              Não teve gasto <span className="text-sec">(N/A, usei material que já tinha)</span>
            </span>
          </label>
          {!semGasto && gastoTexto !== '' && gastoLido === null && <p className="text-sm text-alerta">Valor inválido.</p>}
        </section>

        {gastoValido && (
          <section className={`cartao p-5 ${r.lucro < 0 ? 'border-alerta/40' : 'border-positivo/30 bg-gradient-to-br from-[#0D2A2E] to-cartao'}`}>
            <p className={`rotulo ${r.lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>Lucro do dia</p>
            <p className={`mt-1 text-4xl font-extrabold ${r.lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>{reais(r.lucro)}</p>
            <p className="mt-1 text-sm text-sec">
              {semGasto ? 'Sem gasto com material' : `Faturamento − gasto de ${reais(r.gasto)}`} · margem {porcentagem(r.margem)}
            </p>
          </section>
        )}

        {r.disponivel !== null && r.disponivel > 0 && <Aviso tipo="info">Sobraram {r.disponivel} itens dos produtos com estoque.</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
      </div>

      <Rodape>
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={fechar} disabled={enviando || !online || !gastoValido || reservas > 0}>
          <Icone nome="cadeado" /> {enviando ? 'Fechando…' : 'Fechar o dia e gerar imagens'}
        </button>
        <p className="mt-2 text-center text-xs text-sec">O dia fica bloqueado. Dá para reabrir para corrigir.</p>
      </Rodape>
    </Pagina>
  )
}
