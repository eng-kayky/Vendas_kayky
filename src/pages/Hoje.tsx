import { Link, useNavigate } from 'react-router-dom'
import { carregarHoje, diaAnteriorAberto, type DiaCompleto } from '../lib/api'
import { dataCurta, dataLonga, diaMes, diaDaSemana, hojeBelem } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { calcularResumo, estoqueBaixo, type LinhaResumo } from '../lib/resumo'
import { supabase } from '../lib/supabase'
import { useCarregar, useOnline } from '../hooks'
import { Abas, Aviso, Barra, Carregando, Icone, Marca, Rodape } from '../components/ui'
import VendasLista from '../components/VendasLista'

export default function Hoje() {
  const hoje = hojeBelem()
  const { dados, erro, carregando, recarregar } = useCarregar(
    async () => ({ atual: await carregarHoje(), anterior: await diaAnteriorAberto() }),
    [hoje],
    20000,
  )

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-[max(env(safe-area-inset-top),12px)] md:px-8 md:pb-12 md:pt-8">
      <Cabecalho data={hoje} aberto={dados?.atual?.dia.status === 'aberto' ? dados.atual : null} />

      {erro && (
        <div className="mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}

      {dados?.anterior && (
        <div className="mb-4">
          <Aviso>
            O dia {dataCurta(dados.anterior.data)} ficou aberto.{' '}
            <Link to={`/finalizar/${dados.anterior.id}`} className="font-bold underline">
              Finalizar esse dia
            </Link>
          </Aviso>
        </div>
      )}

      {carregando && !dados ? (
        <Carregando />
      ) : !dados?.atual ? (
        <SemDia data={hoje} />
      ) : dados.atual.dia.status === 'fechado' ? (
        <DiaFechado diaId={dados.atual.dia.id} />
      ) : (
        <DiaAberto dia={dados.atual} onMudou={recarregar} />
      )}
    </main>
  )
}

function Cabecalho({ data, aberto }: { data: string; aberto: DiaCompleto | null }) {
  const online = useOnline()
  return (
    <>
      {/* celular */}
      <header className="flex items-start justify-between gap-3 pb-4 pt-2 md:hidden">
        <div className="min-w-0">
          <p className="text-sm text-sec">
            {diaDaSemana(data)}, {diaMes(data)}
          </p>
          <h1 className="text-3xl font-extrabold">Hoje</h1>
        </div>
        <div className="flex items-center gap-2">
          {aberto && <Pilula />}
          <Link
            to="/historico"
            className="grid size-11 place-items-center rounded-xl border border-borda bg-cartao"
            aria-label="Histórico"
          >
            <Icone nome="relogio" />
          </Link>
        </div>
      </header>

      {/* desktop */}
      <header className="hidden items-center justify-between gap-4 pb-5 md:flex">
        <div className="flex items-center gap-3">
          <Marca tamanho={52} />
          <div>
            <h1 className="text-2xl font-extrabold">Controle de Vendas</h1>
            <p className="text-sec">{dataLonga(data)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {aberto && <Pilula texto="Dia aberto" />}
          {aberto && (
            <Link
              to={`/finalizar/${aberto.dia.id}`}
              className={`btn-primario min-h-13 px-6 text-lg ${online ? '' : 'pointer-events-none opacity-50'}`}
            >
              <Icone nome="check" /> Finalizar vendas
            </Link>
          )}
          <button type="button" className="btn-secundario" onClick={() => supabase.auth.signOut()} title="Sair">
            <Icone nome="sair" />
            <span className="sr-only">Sair</span>
          </button>
        </div>
      </header>
      <div className="mb-5 hidden md:block">
        <Abas />
      </div>
    </>
  )
}

function Pilula({ texto = 'Aberto' }: { texto?: string }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-positivo/30 bg-positivo/10 px-4 text-sm font-semibold text-positivo">
      <span className="size-2 rounded-full bg-positivo" /> {texto}
    </span>
  )
}

function SemDia({ data }: { data: string }) {
  const online = useOnline()
  const nav = useNavigate()
  return (
    <section className="cartao mx-auto max-w-lg px-6 py-12 text-center">
      <p className="text-sec">{dataLonga(data)}</p>
      <h2 className="mt-2 text-2xl font-extrabold">O dia ainda não foi aberto</h2>
      <p className="mt-2 text-sec">Informe quanto foi produzido de cada produto para começar a vender.</p>
      <button type="button" className="btn-primario mt-6 min-h-12 w-full text-lg" disabled={!online} onClick={() => nav('/abrir')}>
        Abrir o dia
      </button>
      <button type="button" className="btn mt-3 w-full text-sec md:hidden" onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    </section>
  )
}

function DiaFechado({ diaId }: { diaId: string }) {
  return (
    <section className="cartao mx-auto max-w-lg px-6 py-12 text-center">
      <h2 className="text-2xl font-extrabold">Vendas de hoje finalizadas</h2>
      <p className="mt-2 text-sec">O dia está bloqueado. Para alterar, reabra pelo Histórico.</p>
      <div className="mt-6 flex flex-col gap-2">
        <Link to={`/resultado/${diaId}`} className="btn-primario min-h-12 text-lg">
          <Icone nome="imagem" /> Ver imagem do resumo
        </Link>
        <Link to={`/historico/${diaId}`} className="btn-secundario min-h-12">
          Abrir no Histórico
        </Link>
      </div>
    </section>
  )
}

function DiaAberto({ dia, onMudou }: { dia: DiaCompleto; onMudou: () => void }) {
  const online = useOnline()
  const resumo = calcularResumo(dia.itens, dia.vendas)
  const t = resumo.totais
  const baixos = resumo.itens.filter((i) => estoqueBaixo(i.restante, i.produzido))

  return (
    <>
      {baixos.length > 0 && (
        <div className="mb-4 hidden space-y-2 md:block">
          {baixos.map((b) => (
            <Aviso key={b.id}>
              <strong>{b.nome}:</strong>{' '}
              {b.restante < 0
                ? `vendido ${-b.restante} acima do produzido.`
                : `restam ${b.restante} de ${b.produzido} unidades · ${porcentagem(b.vendido / b.produzido, 0)} já vendido.`}
            </Aviso>
          ))}
        </div>
      )}

      {/* Indicadores: no celular, tocar abre "Vendas de hoje" */}
      <Link to="/vendas" className="mb-4 block md:pointer-events-none" aria-label="Ver vendas de hoje">
        <div className="num grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          <div className="cartao p-4 md:p-6">
            <p className="rotulo">
              <span className="md:hidden">Líquido</span>
              <span className="hidden md:inline">Faturamento líquido</span>
            </p>
            <p className="mt-1 text-2xl font-extrabold md:text-4xl">{reais(t.liquido)}</p>
            <p className="mt-1 text-sm text-sec">
              Bruto {reais(t.bruto)}
              <span className="hidden md:inline"> · desconto {reais(t.descontos)}</span>
            </p>
          </div>
          <div className="cartao p-4 md:p-6">
            <p className="rotulo">
              <span className="md:hidden">Vendas</span>
              <span className="hidden md:inline">Recebido por</span>
            </p>
            <p className="mt-1 text-2xl font-extrabold md:hidden">{t.vendas}</p>
            <p className="mt-1 text-sm text-sec md:hidden">{t.vendido} unidades</p>
            <dl className="mt-2 hidden space-y-1 md:block">
              {(
                [
                  ['Pix', resumo.pagamentos.pix],
                  ['Dinheiro', resumo.pagamentos.dinheiro],
                  ['Cartão', resumo.pagamentos.cartao],
                ] as const
              ).map(([rotulo, v]) => (
                <div key={rotulo} className="flex justify-between">
                  <dt className="text-sec">{rotulo}</dt>
                  <dd className="font-bold">{reais(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="cartao hidden p-6 md:block">
            <p className="rotulo">Unidades vendidas</p>
            <p className="mt-1 text-4xl font-extrabold">
              {t.vendido} <span className="text-xl font-medium text-sec">/ {t.produzido}</span>
            </p>
            <div className="mt-3">
              <Barra valor={t.vendido} total={t.produzido} />
            </div>
            <p className="mt-2 text-sm text-sec">{t.sobra_unidades} restantes</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 md:hidden">
          <div className="w-2/5">
            <Barra valor={t.vendido} total={t.produzido} />
          </div>
          <p className="num text-sm text-sec">
            {t.vendido} de {t.produzido} vendidas · {t.sobra_unidades} restantes
          </p>
        </div>
      </Link>

      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        {resumo.itens.map((i) => (
          <CartaoProduto key={i.id} item={i} online={online} />
        ))}
      </div>

      <section className="cartao mt-6 hidden p-6 md:block">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Últimas vendas</h2>
          <p className="text-sm text-sec">{dia.vendas.length} vendas hoje</p>
        </div>
        <VendasLista vendas={dia.vendas} itens={dia.itens} aberto modo="tabela" onMudou={onMudou} />
      </section>

      <div className="md:hidden">
        <Rodape>
          <Link
            to={`/finalizar/${dia.dia.id}`}
            className={`btn-primario min-h-14 w-full text-lg ${online ? '' : 'pointer-events-none opacity-50'}`}
          >
            <Icone nome="check" /> Finalizar vendas
          </Link>
        </Rodape>
      </div>
    </>
  )
}

function CartaoProduto({ item, online }: { item: LinhaResumo; online: boolean }) {
  const baixo = estoqueBaixo(item.restante, item.produzido)
  const nav = useNavigate()
  const vender = () => nav(`/vender/${item.id}`)
  return (
    <article className={`cartao num p-4 md:p-6 ${baixo ? 'border-alerta/50' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-lg font-bold">{item.nome}</h3>
        <span className="shrink-0 rounded-full bg-borda px-3 py-1 text-sm font-semibold text-claro">{reais(item.preco)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className={`text-5xl font-extrabold ${item.restante < 0 ? 'text-alerta' : ''}`}>{item.restante}</span>
          <span className={baixo ? 'text-alerta md:text-sec' : 'text-sec'}>
            restantes<span className="md:hidden">{baixo ? ' · baixo' : ''}</span>
          </span>
        </p>
        <button type="button" className="btn-primario min-h-14 w-32 text-lg md:hidden" onClick={vender} disabled={!online}>
          Vender
        </button>
        <span
          className={`hidden rounded-full px-3 py-1 text-sm font-semibold md:inline ${
            baixo ? 'bg-alerta/15 text-alerta' : 'bg-positivo/15 text-positivo'
          }`}
        >
          {baixo ? 'Baixo' : 'Normal'}
        </span>
      </div>
      <div className="mt-3">
        <Barra valor={item.vendido} total={item.produzido} baixo={baixo} />
      </div>
      <div className="mt-2 flex justify-between text-sm text-sec">
        <span className="md:hidden">
          {item.vendido} de {item.produzido} vendidas
        </span>
        <span className="hidden md:inline">Vendido {item.vendido}</span>
        <span className="hidden md:inline">Produzido {item.produzido}</span>
      </div>
      <button type="button" className="btn-primario mt-4 hidden min-h-13 w-full text-lg md:flex" onClick={vender} disabled={!online}>
        Registrar venda
      </button>
    </article>
  )
}
