import { Link, useNavigate } from 'react-router-dom'
import { carregarHoje, diaAnteriorAberto, situacaoFiados, type DiaCompleto } from '../lib/api'
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
            <Link to={`/dia/${dados.anterior.id}`} className="font-bold underline">
              Abrir esse dia
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
            to="/fiado"
            className="grid size-11 place-items-center rounded-xl border border-borda bg-cartao"
            aria-label="Fiado"
          >
            <Icone nome="carteira" />
          </Link>
          <Link
            to="/produtos"
            className="grid size-11 place-items-center rounded-xl border border-borda bg-cartao"
            aria-label="Produtos"
          >
            <Icone nome="caixa" />
          </Link>
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

export function DiaAberto({ dia, onMudou }: { dia: DiaCompleto; onMudou: () => void }) {
  const online = useOnline()
  const resumo = calcularResumo(dia.itens, dia.vendas)
  const t = resumo.totais
  const baixos = resumo.itens.filter((i) => estoqueBaixo(i.restante, i.produzido))
  const reservas = dia.vendas.filter((v) => v.status === 'reservada')
  const valorReservado = reservas.reduce((s, v) => s + v.valor_cobrado, 0)
  const nomeItem = new Map(dia.itens.map((i) => [i.id, i.nome]))

  // Fiado: o que já foi pago conta como recebido; só o resto fica "a receber"
  const vendasFiado = dia.vendas.filter((v) => v.status !== 'reservada' && v.pagamento === 'fiado')
  const idsFiado = vendasFiado.map((v) => v.id)
  const { dados: situacao } = useCarregar(() => situacaoFiados(idsFiado), [idsFiado.join(',')])
  const sit = situacao ?? {}
  const fiadoPago = vendasFiado.filter((v) => sit[v.id]).reduce((s, v) => s + v.valor_cobrado, 0)
  const abertos = vendasFiado.filter((v) => !sit[v.id])
  const fiadoAberto = abertos.reduce((s, v) => s + v.valor_cobrado, 0)
  const recebido = resumo.pagamentos.pix + resumo.pagamentos.dinheiro + resumo.pagamentos.cartao + fiadoPago
  const base = Math.max(1, recebido + fiadoAberto + valorReservado)

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

      {/* Painel do dia: faturamento e para onde foi o dinheiro */}
      <section className="num mb-4 grid gap-3 md:grid-cols-[2fr_1fr] md:gap-4">
        <div className="cartao p-4 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <p className="rotulo">Faturamento do dia</p>
              <p className="mt-1 text-4xl font-extrabold md:text-5xl">{reais(t.liquido)}</p>
            </div>
            <Link to="/vendas" className="text-sm text-claro underline-offset-4 hover:underline md:hidden">
              Ver as {t.vendas} vendas
            </Link>
            {t.descontos !== 0 && <p className="text-sm text-sec">descontos {reais(t.descontos)}</p>}
          </div>

          {/* barra dividida: recebido · fiado a receber · reservado */}
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-borda" aria-hidden>
            <div className="h-full bg-positivo" style={{ width: `${(recebido / base) * 100}%` }} />
            <div className="h-full bg-alerta" style={{ width: `${(fiadoAberto / base) * 100}%` }} />
            <div className="h-full bg-claro" style={{ width: `${(valorReservado / base) * 100}%` }} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-positivo">
                <span className="size-2.5 rounded-full bg-positivo" /> Recebido
              </p>
              <p className="text-2xl font-extrabold">{reais(recebido)}</p>
              <p className="text-xs text-sec">
                Pix {reais(resumo.pagamentos.pix)} · Din. {reais(resumo.pagamentos.dinheiro)} · Cartão {reais(resumo.pagamentos.cartao)}
                {fiadoPago > 0 && <> · fiado pago {reais(fiadoPago)}</>}
              </p>
            </div>
            <Link to="/fiado" className="-m-2 rounded-xl p-2 hover:bg-alerta/5">
              <p className={`flex items-center gap-2 text-sm font-semibold ${fiadoAberto ? 'text-alerta' : 'text-sec'}`}>
                <span className="size-2.5 rounded-full bg-alerta" /> Fiado a receber
              </p>
              <p className={`text-2xl font-extrabold ${fiadoAberto ? 'text-alerta' : ''}`}>{reais(fiadoAberto)}</p>
              <p className="text-xs text-sec">
                {abertos.length
                  ? `${abertos.length} ${abertos.length === 1 ? 'venda' : 'vendas'}: ${[...new Set(abertos.map((v) => v.cliente))].join(', ')}`
                  : vendasFiado.length
                    ? 'todo o fiado de hoje já foi pago'
                    : 'nenhum fiado hoje'}
              </p>
            </Link>
            <div>
              <p className={`flex items-center gap-2 text-sm font-semibold ${t.reservas ? 'text-claro' : 'text-sec'}`}>
                <span className="size-2.5 rounded-full bg-claro" /> Reservado
              </p>
              <p className={`text-2xl font-extrabold ${t.reservas ? 'text-claro' : ''}`}>{reais(valorReservado)}</p>
              <p className="text-xs text-sec">
                {t.reservas ? `${t.reservas} ${t.reservas === 1 ? 'reserva' : 'reservas'} · ${t.reservado} un.` : 'nenhuma reserva'}
              </p>
            </div>
          </div>
        </div>

        <div className="cartao flex flex-col justify-between gap-3 p-4 md:p-6">
          <div className="flex items-end justify-between md:block">
            <div>
              <p className="rotulo">Unidades vendidas</p>
              <p className="mt-1 text-3xl font-extrabold md:text-4xl">
                {t.vendido} <span className="text-lg font-medium text-sec">de {t.produzido}</span>
              </p>
            </div>
            <p className="text-sm text-sec md:mt-1">
              {t.vendas} {t.vendas === 1 ? 'venda' : 'vendas'}
            </p>
          </div>
          <div>
            <Barra valor={t.vendido} total={t.produzido} />
            <p className="mt-2 text-sm text-sec">{t.sobra_unidades} disponíveis para vender</p>
          </div>
        </div>
      </section>

      {reservas.length > 0 && (
        <section className="cartao mb-4 border-claro/40 p-4 md:p-5">
          <h2 className="mb-2 text-lg font-bold text-claro">Reservas para entregar</h2>
          <ul className="divide-y divide-borda/60">
            {reservas.map((v) => (
              <li key={v.id} className="num flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{v.cliente}</p>
                  <p className="text-sm text-sec">
                    {v.quantidade}× {nomeItem.get(v.item_dia_id)} · {reais(v.valor_cobrado)}
                  </p>
                </div>
                <Link
                  to={`/venda/${v.id}`}
                  className={`btn-primario shrink-0 px-4 ${online ? '' : 'pointer-events-none opacity-50'}`}
                >
                  Entregar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
        {resumo.itens.map((i) => (
          <CartaoProduto key={i.id} item={i} online={online} />
        ))}
      </div>
      <Link
        to={`/editar-dia/${dia.dia.id}`}
        className={`btn mt-3 min-h-12 w-full border border-dashed border-borda text-claro hover:border-destaque md:w-auto md:px-6 ${
          online ? '' : 'pointer-events-none opacity-50'
        }`}
      >
        <Icone nome="lapis" tamanho={18} /> Editar produtos do dia
      </Link>

      <section className="cartao mt-6 hidden p-6 md:block">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Últimas vendas</h2>
          <p className="text-sm text-sec">{t.vendas} vendas hoje</p>
        </div>
        <VendasLista vendas={dia.vendas} itens={dia.itens} aberto modo="tabela" onMudou={onMudou} situacao={sit} />
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
            disponíveis<span className="md:hidden">{baixo ? ' · baixo' : ''}</span>
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
          {item.vendido} de {item.produzido} vendidas{item.reservado ? ` · ${item.reservado} reservadas` : ''}
        </span>
        <span className="hidden md:inline">
          Vendido {item.vendido}
          {item.reservado ? ` · reservado ${item.reservado}` : ''}
        </span>
        <span className="hidden md:inline">Produzido {item.produzido}</span>
      </div>
      <button type="button" className="btn-primario mt-4 hidden min-h-13 w-full text-lg md:flex" onClick={vender} disabled={!online}>
        Registrar venda
      </button>
    </article>
  )
}
