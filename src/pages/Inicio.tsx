import { Link, useNavigate } from 'react-router-dom'
import { carregarHoje, diasAbertosAnteriores } from '../lib/api'
import { dataCurta, dataLonga, hojeBelem } from '../lib/datas'
import { useCarregar, useOnline } from '../hooks'
import PainelDia from '../components/PainelDia'
import { Aviso, Carregando, Icone, Pagina } from '../components/ui'

/** Tela inicial: o dia de hoje (ou o convite para abrir). */
export default function Inicio() {
  const hoje = hojeBelem()
  const { dados, erro, carregando, recarregar } = useCarregar(
    async () => ({ atual: await carregarHoje(), abertos: await diasAbertosAnteriores() }),
    [hoje],
    20000,
  )

  if (carregando && !dados) return <Carregando />

  const avisoAbertos = dados?.abertos.length ? (
    <div className="mx-auto mb-3 max-w-6xl px-4 pt-3 md:pt-6">
      <Aviso>
        {dados.abertos.length === 1 ? 'Um dia anterior ficou aberto' : `${dados.abertos.length} dias anteriores ficaram abertos`}:{' '}
        {dados.abertos.map((d, i) => (
          <span key={d.id}>
            {i > 0 && ', '}
            <Link to={`/dia/${d.id}`} className="font-bold underline">
              {dataCurta(d.data)}
            </Link>
          </span>
        ))}
        . Abra e feche para o relatório contar.
      </Aviso>
    </div>
  ) : null

  if (erro && !dados)
    return (
      <Pagina comNav>
        <Aviso>{erro}</Aviso>
      </Pagina>
    )

  return (
    <>
      {avisoAbertos}
      {dados?.atual ? <PainelDia d={dados.atual} onMudou={recarregar} /> : <SemDia hoje={hoje} />}
    </>
  )
}

function SemDia({ hoje }: { hoje: string }) {
  const nav = useNavigate()
  const online = useOnline()
  return (
    <Pagina comNav>
      <section className="cartao mt-6 px-6 py-10 text-center">
        <p className="text-sec">{dataLonga(hoje)}</p>
        <h1 className="mt-2 text-2xl font-extrabold">Nenhum dia de vendas aberto hoje</h1>
        <p className="mt-2 text-sec">Escolha os produtos que vai vender hoje, com preço e quantidade.</p>
        <button type="button" className="btn-primario mt-6 min-h-14 w-full text-lg" disabled={!online} onClick={() => nav('/abrir')}>
          <Icone nome="mais" /> Abrir o dia de hoje
        </button>
        <Link to="/abrir?outra=1" className="btn mt-3 min-h-11 w-full text-sm text-claro">
          <Icone nome="calendario" tamanho={18} /> Lançar um dia que já passou
        </Link>
      </section>
    </Pagina>
  )
}
