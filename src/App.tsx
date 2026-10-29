import { Navigate, Route, Routes } from 'react-router-dom'
import { useOnline, useSessao } from './hooks'
import { configurado } from './lib/supabase'
import { Carregando } from './components/ui'
import Login from './pages/Login'
import Hoje from './pages/Hoje'
import AbrirDia from './pages/AbrirDia'
import RegistrarVenda from './pages/RegistrarVenda'
import VendasHoje from './pages/VendasHoje'
import Finalizar from './pages/Finalizar'
import Resultado from './pages/Resultado'
import Historico from './pages/Historico'
import HistoricoDia from './pages/HistoricoDia'

export default function App() {
  const sessao = useSessao()
  const online = useOnline()

  if (!configurado) {
    return (
      <p className="mx-auto max-w-md p-6 text-center text-sec">
        Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code>.
      </p>
    )
  }

  return (
    <>
      {!online && (
        <div role="alert" className="sticky top-0 z-30 bg-alerta px-4 py-2 text-center text-sm font-semibold text-fundo">
          Sem conexão. Não dá para registrar vendas até a internet voltar.
        </div>
      )}
      {sessao === undefined ? (
        <Carregando />
      ) : sessao === null ? (
        <Login />
      ) : (
        <Routes>
          <Route path="/" element={<Hoje />} />
          <Route path="/abrir" element={<AbrirDia />} />
          <Route path="/vender/:itemId" element={<RegistrarVenda />} />
          <Route path="/vendas" element={<VendasHoje />} />
          <Route path="/finalizar/:diaId" element={<Finalizar />} />
          <Route path="/resultado/:diaId" element={<Resultado />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/historico/:diaId" element={<HistoricoDia />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  )
}
