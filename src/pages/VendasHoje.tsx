import { carregarHoje } from '../lib/api'
import { dataLonga, hojeBelem } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { calcularResumo } from '../lib/resumo'
import { useCarregar } from '../hooks'
import { Aviso, Carregando, Pagina, Topo } from '../components/ui'
import VendasLista from '../components/VendasLista'

export default function VendasHoje() {
  const { dados, erro, carregando, recarregar } = useCarregar(carregarHoje, [], 20000)
  const t = dados ? calcularResumo(dados.itens, dados.vendas).totais : null

  return (
    <Pagina>
      <Topo titulo="Vendas de hoje" sub={dataLonga(hojeBelem())} />
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && !dados ? (
        <Carregando />
      ) : !dados ? (
        <p className="py-10 text-center text-sec">O dia ainda não foi aberto.</p>
      ) : (
        <>
          {t && (
            <div className="cartao num mb-4 grid grid-cols-3 divide-x divide-borda py-3 text-center">
              <div>
                <p className="rotulo">Vendas</p>
                <p className="text-lg font-bold">{dados.vendas.length}</p>
              </div>
              <div>
                <p className="rotulo">Líquido</p>
                <p className="text-lg font-bold">{reais(t.liquido)}</p>
              </div>
              <div>
                <p className="rotulo">Descontos</p>
                <p className="text-lg font-bold text-alerta">{reais(t.descontos)}</p>
              </div>
            </div>
          )}
          <VendasLista
            vendas={dados.vendas}
            itens={dados.itens}
            aberto={dados.dia.status === 'aberto'}
            modo="cartoes"
            onMudou={recarregar}
          />
        </>
      )}
    </Pagina>
  )
}
