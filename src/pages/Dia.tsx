import { Navigate, useParams } from 'react-router-dom'
import { carregarDia } from '../lib/api'
import { hojeBelem } from '../lib/datas'
import { useCarregar } from '../hooks'
import PainelDia from '../components/PainelDia'
import { Aviso, Carregando, Pagina, Topo } from '../components/ui'

/** Qualquer dia pelo id (o de hoje, aberto, mora em "/"). */
export default function Dia() {
  const { diaId = '' } = useParams()
  const { dados, erro, carregando, recarregar } = useCarregar(() => carregarDia(diaId), [diaId], 20000)

  if (carregando && !dados) return <Carregando />
  if (!dados)
    return (
      <Pagina comNav>
        <Topo titulo="Dia" voltar="/historico" />
        <Aviso>{erro ?? 'Dia não encontrado.'}</Aviso>
      </Pagina>
    )
  if (dados.dia.data === hojeBelem() && dados.dia.status === 'aberto') return <Navigate to="/" replace />
  return <PainelDia d={dados} onMudou={recarregar} />
}
