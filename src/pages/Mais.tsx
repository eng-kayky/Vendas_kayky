import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Icone, Pagina, TituloSecao, type NomeIcone } from '../components/ui'

const ITENS: { para: string; icone: NomeIcone; titulo: string; sub: string }[] = [
  { para: '/produtos', icone: 'caixa', titulo: 'Produtos', sub: 'Cadastrar, mudar preço, unidade e categoria' },
  { para: '/relatorio', icone: 'grafico', titulo: 'Relatório', sub: 'Semana e mês, com imagem para compartilhar' },
  { para: '/abrir?outra=1', icone: 'calendario', titulo: 'Lançar outro dia', sub: 'Abrir um dia que já passou' },
]

/** Menu do celular com o que não cabe na barra de baixo. */
export default function Mais() {
  return (
    <Pagina comNav>
      <TituloSecao titulo="Mais" />
      <ul className="space-y-2">
        {ITENS.map((i) => (
          <li key={i.para}>
            <Link to={i.para} className="cartao flex min-h-16 items-center gap-4 px-4 py-3 hover:border-destaque/60">
              <Icone nome={i.icone} tamanho={24} className="text-claro" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{i.titulo}</p>
                <p className="text-sm text-sec">{i.sub}</p>
              </div>
              <Icone nome="avancar" className="text-sec" />
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-secundario mt-6 min-h-12 w-full" onClick={() => supabase.auth.signOut()}>
        <Icone nome="sair" /> Sair da conta
      </button>
    </Pagina>
  )
}
