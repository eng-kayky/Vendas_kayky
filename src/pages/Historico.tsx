import { Link } from 'react-router-dom'
import { listarHistorico } from '../lib/api'
import { dataCurta, diaDaSemana, hojeBelem } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { useCarregar } from '../hooks'
import { Abas, Aviso, Carregando, Pagina, Topo } from '../components/ui'

export default function Historico() {
  const { dados, erro, carregando } = useCarregar(listarHistorico)

  return (
    <Pagina largura="max-w-3xl">
      <div className="md:hidden">
        <Topo titulo="Histórico" />
      </div>
      <div className="hidden pb-5 pt-6 md:block">
        <h1 className="mb-4 text-3xl font-extrabold">Histórico</h1>
        <Abas />
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      <Link to="/lancar" className="btn-secundario mb-4 min-h-12 w-full border-dashed text-claro">
        + Lançar dia anterior
      </Link>
      {carregando && !dados ? (
        <Carregando />
      ) : !dados?.length ? (
        <p className="py-10 text-center text-sec">Nenhum dia registrado ainda.</p>
      ) : (
        <ul className="num space-y-2">
          {dados.map((d) => (
            <li key={d.id}>
              <Link
                to={d.status === 'fechado' ? `/historico/${d.id}` : d.data === hojeBelem() ? '/' : `/finalizar/${d.id}`}
                className="cartao flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:border-destaque/60"
              >
                <div>
                  <p className="font-bold">{dataCurta(d.data)}</p>
                  <p className="text-sm text-sec">
                    {diaDaSemana(d.data)}
                    {d.resumido ? ' · lançado por resumo' : ''}
                  </p>
                </div>
                {d.status === 'fechado' ? (
                  <div className="text-right">
                    <p className={`font-bold ${d.lucro! < 0 ? 'text-alerta' : 'text-positivo'}`}>{reais(d.lucro!)}</p>
                    <p className="text-sm text-sec">líquido {reais(d.liquido!)}</p>
                  </div>
                ) : (
                  <span className="rounded-full bg-positivo/15 px-3 py-1 text-sm font-semibold text-positivo">Aberto</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  )
}
