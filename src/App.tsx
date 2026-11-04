import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useOnline, useSessao } from './hooks'
import { Carregando, Navegacao } from './components/ui'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Dia from './pages/Dia'
import Venda from './pages/Venda'
import AbrirDia from './pages/AbrirDia'
import ProdutosDoDia from './pages/ProdutosDoDia'
import FecharDia from './pages/FecharDia'
import Imagens from './pages/Imagens'
import Historico from './pages/Historico'
import Fiado from './pages/Fiado'
import Clientes from './pages/Clientes'
import ClienteFicha from './pages/ClienteFicha'
import Produtos from './pages/Produtos'
import Relatorio from './pages/Relatorio'
import Mais from './pages/Mais'

// Prévia das imagens com dados de exemplo; não vai para o build de produção
const DevImagem = import.meta.env.DEV ? lazy(() => import('./pages/DevImagem')) : null

/** Telas principais mostram a navegação; telas de tarefa (vender, abrir, fechar…) ficam em tela cheia. */
const comNavegacao = (p: string) =>
  p === '/' || ['/fiado', '/clientes', '/historico', '/produtos', '/relatorio', '/mais'].some((s) => p === s || p.startsWith(`${s}/`)) ||
  /^\/dia\/[^/]+$/.test(p)

export default function App() {
  const sessao = useSessao()
  const online = useOnline()
  const { pathname } = useLocation()

  if (DevImagem && pathname === '/dev/imagem') {
    return (
      <Suspense>
        <DevImagem />
      </Suspense>
    )
  }

  return (
    <>
      {!online && (
        <div role="alert" className="sticky top-0 z-40 bg-alerta px-4 py-2 text-center text-sm font-semibold text-fundo">
          Sem conexão. Não dá para registrar vendas até a internet voltar.
        </div>
      )}
      {sessao === undefined ? (
        <Carregando />
      ) : sessao === null ? (
        <Login />
      ) : (
        <>
          {comNavegacao(pathname) && <Navegacao />}
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/abrir" element={<AbrirDia />} />
            <Route path="/dia/:diaId" element={<Dia />} />
            <Route path="/dia/:diaId/venda" element={<Venda />} />
            <Route path="/dia/:diaId/produtos" element={<ProdutosDoDia />} />
            <Route path="/dia/:diaId/fechar" element={<FecharDia />} />
            <Route path="/dia/:diaId/imagem" element={<Imagens />} />
            <Route path="/venda/:pedidoId" element={<Venda />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/fiado" element={<Fiado />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:clienteId" element={<ClienteFicha />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/relatorio" element={<Relatorio />} />
            <Route path="/mais" element={<Mais />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </>
      )}
    </>
  )
}
