import { Navigate, useParams } from 'react-router-dom'
import { carregarDiaPorId } from '../lib/api'
import { dataLonga, hojeBelem } from '../lib/datas'
import { useCarregar } from '../hooks'
import { Aviso, Carregando, Topo } from '../components/ui'
import VendasLista from '../components/VendasLista'
import { DiaAberto } from './Hoje'

/** Um dia anterior reaberto pelo Histórico: mesma tela do "Hoje", para corrigir vendas e finalizar de novo. */
export default function DiaAnterior() {
  const { diaId = '' } = useParams()
  const { dados, erro, carregando, recarregar } = useCarregar(() => carregarDiaPorId(diaId), [diaId], 20000)

  if (dados?.dia.data === hojeBelem()) return <Navigate to="/" replace />
  if (dados?.dia.status === 'fechado') return <Navigate to={`/historico/${diaId}`} replace />

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-[max(env(safe-area-inset-top),12px)] md:px-8 md:pb-12 md:pt-8">
      <Topo titulo="Corrigir dia" sub={dados ? dataLonga(dados.dia.data) : undefined} voltar="/historico" />
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && !dados ? (
        <Carregando />
      ) : !dados ? (
        <Aviso>Dia não encontrado.</Aviso>
      ) : (
        <>
          <div className="mb-4">
            <Aviso tipo="info">
              Este dia foi reaberto. Corrija as vendas (lápis ✏️ para editar, ↶ para desfazer) ou registre o que faltou, e depois toque em
              Finalizar vendas para gerar o resumo de novo.
            </Aviso>
          </div>
          <DiaAberto dia={dados} onMudou={recarregar} />
          <section className="mt-6 md:hidden">
            <h2 className="mb-2 text-lg font-bold">Vendas do dia</h2>
            <VendasLista vendas={dados.vendas} itens={dados.itens} aberto modo="cartoes" onMudou={recarregar} />
          </section>
        </>
      )}
    </main>
  )
}
