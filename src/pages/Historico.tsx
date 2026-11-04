import { Link } from 'react-router-dom'
import { listarHistorico } from '../lib/api'
import { dataCurta, diaDaSemana, hojeBelem } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { useCarregar } from '../hooks'
import { Aviso, Carregando, Icone, Pagina, Selo, TituloSecao, Vazio } from '../components/ui'

/** Todos os dias de venda, do mais novo para o mais antigo, agrupados por mês. */
export default function Historico() {
  const { dados, erro, carregando } = useCarregar(listarHistorico)
  const hoje = hojeBelem()

  const meses = new Map<string, NonNullable<typeof dados>>()
  for (const h of dados ?? []) {
    const chave = h.dia.data.slice(0, 7)
    meses.set(chave, [...(meses.get(chave) ?? []), h])
  }
  const nomeMes = (aaaamm: string) =>
    new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${aaaamm}-15T12:00:00Z`))

  return (
    <Pagina largura="max-w-3xl" comNav>
      <TituloSecao
        titulo="Histórico"
        sub="Toque num dia para ver, corrigir ou gerar as imagens"
        acao={
          <Link to="/abrir?outra=1" className="btn-secundario shrink-0">
            <Icone nome="calendario" tamanho={18} /> Outro dia
          </Link>
        }
      />
      <Link to="/relatorio" className="cartao mb-4 flex items-center justify-between gap-3 p-4 hover:border-destaque/60">
        <span className="flex items-center gap-3 font-semibold">
          <Icone nome="grafico" /> Relatório da semana e do mês
        </span>
        <Icone nome="avancar" className="text-sec" />
      </Link>

      {erro && <Aviso>{erro}</Aviso>}
      {carregando && !dados ? (
        <Carregando />
      ) : !dados?.length ? (
        <Vazio>Nenhum dia de vendas ainda.</Vazio>
      ) : (
        <div className="num space-y-5">
          {[...meses.entries()].map(([mes, lista]) => {
            const fechados = lista.filter((h) => h.dia.status === 'fechado')
            return (
              <section key={mes}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="rotulo">{nomeMes(mes)}</h2>
                  <p className="text-xs text-sec">
                    {reais(lista.reduce((s, h) => s + h.faturamento, 0))} · lucro {reais(fechados.reduce((s, h) => s + (h.lucro ?? 0), 0))}
                  </p>
                </div>
                <ul className="space-y-2">
                  {lista.map((h) => (
                    <li key={h.dia.id}>
                      <Link
                        to={h.dia.data === hoje && h.dia.status === 'aberto' ? '/' : `/dia/${h.dia.id}`}
                        className="cartao flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:border-destaque/60"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-bold">
                            {dataCurta(h.dia.data)}
                            {h.dia.status === 'aberto' && <Selo cor="positivo">Aberto</Selo>}
                          </p>
                          <p className="text-sm text-sec">
                            {diaDaSemana(h.dia.data)} · {h.vendas} {h.vendas === 1 ? 'venda' : 'vendas'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold">{reais(h.faturamento)}</p>
                          {h.lucro !== null ? (
                            <p className={`text-sm ${h.lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>lucro {reais(h.lucro)}</p>
                          ) : (
                            <p className="text-sm text-sec">ainda aberto</p>
                          )}
                          {h.aReceber > 0 && <p className="text-xs text-alerta">{reais(h.aReceber)} a receber</p>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Pagina>
  )
}
