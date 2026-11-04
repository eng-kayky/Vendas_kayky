import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listarClientes } from '../lib/api'
import { dataCurta } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { useCarregar } from '../hooks'
import { Aviso, Carregando, Icone, Pagina, TituloSecao, Vazio } from '../components/ui'

/** Clientes com quanto compraram, quanto devem e a última compra. */
export default function Clientes() {
  const { dados, erro, carregando } = useCarregar(listarClientes)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<'recentes' | 'devendo' | 'mais'>('recentes')

  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const lista = (dados ?? [])
    .filter((c) => !termo || c.nome.toLocaleLowerCase('pt-BR').includes(termo))
    .sort((a, b) =>
      ordem === 'devendo' ? b.deve - a.deve : ordem === 'mais' ? b.total - a.total : (b.ultimaCompra ?? '').localeCompare(a.ultimaCompra ?? ''),
    )

  return (
    <Pagina largura="max-w-3xl" comNav>
      <TituloSecao titulo="Clientes" sub={dados ? `${dados.length} cadastrados` : undefined} />
      <div className="mb-3 flex min-h-12 items-center gap-2 rounded-xl border border-borda bg-cartao px-3 focus-within:border-destaque">
        <Icone nome="busca" className="text-sec" />
        <label htmlFor="busca" className="sr-only">
          Buscar cliente
        </label>
        <input id="busca" className="w-full bg-transparent outline-none" placeholder="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(
          [
            ['recentes', 'Recentes'],
            ['devendo', 'Devendo'],
            ['mais', 'Mais compram'],
          ] as const
        ).map(([v, t]) => (
          <button
            key={v}
            type="button"
            className={`btn min-h-10 shrink-0 rounded-full px-4 text-sm ${ordem === v ? 'bg-destaque text-fundo' : 'border border-borda text-sec'}`}
            onClick={() => setOrdem(v)}
          >
            {t}
          </button>
        ))}
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {carregando && !dados ? (
        <Carregando />
      ) : !lista.length ? (
        <Vazio>{termo ? 'Nenhum cliente com esse nome.' : 'Os clientes aparecem aqui quando você registra uma venda com o nome.'}</Vazio>
      ) : (
        <ul className="num space-y-2">
          {lista.map((c) => (
            <li key={c.id}>
              <Link to={`/clientes/${c.id}`} className="cartao flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:border-destaque/60">
                <div className="min-w-0">
                  <p className="truncate font-bold">{c.nome}</p>
                  <p className="text-sm text-sec">
                    {c.compras} {c.compras === 1 ? 'compra' : 'compras'}
                    {c.ultimaCompra && ` · última ${dataCurta(c.ultimaCompra.slice(0, 10))}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold">{reais(c.total)}</p>
                  {c.deve > 0 && <p className="text-sm font-semibold text-alerta">deve {reais(c.deve)}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  )
}
