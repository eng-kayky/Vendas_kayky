import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { excluirDia, mensagemErro, reabrirDia } from '../lib/api'
import { dataLonga, diaDaSemana, diaMes, hojeBelem } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { estoqueBaixo, resumirDia, vendasPorProduto, type LinhaProduto, type ResumoDia } from '../lib/calculos'
import { ROTULO_PAGAMENTO, type DiaCompleto } from '../lib/tipos'
import { useOnline } from '../hooks'
import { hora } from '../lib/datas'
import ListaVendas, { descreverPedido, SeloPagamento } from './ListaVendas'
import { Aviso, Barra, Confirmar, Icone, Pagina, Rodape, Selo } from './ui'

/** Painel de um dia: trabalhar (aberto) ou ver o resumo (fechado). Serve para hoje e dias anteriores. */
export default function PainelDia({ d, onMudou }: { d: DiaCompleto; onMudou: () => void }) {
  const r = resumirDia(d)
  const ehHoje = d.dia.data === hojeBelem()
  return d.dia.status === 'aberto' ? <DiaAberto d={d} r={r} ehHoje={ehHoje} onMudou={onMudou} /> : <DiaFechado d={d} r={r} ehHoje={ehHoje} onMudou={onMudou} />
}

function Cabecalho({ d, ehHoje, children }: { d: DiaCompleto; ehHoje: boolean; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 pb-4 pt-2">
      <div className="min-w-0">
        <p className="text-sm text-sec">
          {diaDaSemana(d.dia.data)}, {diaMes(d.dia.data)}
        </p>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold">
          {ehHoje ? 'Hoje' : dataLonga(d.dia.data).split(', ')[1]}
          {d.dia.status === 'aberto' ? <Selo cor="positivo">Aberto</Selo> : <Selo>Fechado</Selo>}
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </header>
  )
}

/** Faturamento do dia com a barra recebido · fiado a receber · reservado */
function PainelValores({ d, r }: { d: DiaCompleto; r: ResumoDia }) {
  const base = Math.max(1, r.recebido + r.aReceber + r.reservadoValor)
  const devedores = [...new Set(d.pedidos.filter((p) => p.status === 'concluido' && p.pagamento === 'fiado' && !p.fiadoPagoEm).map((p) => p.cliente))]
  return (
    <section className="num grid gap-3 md:grid-cols-[2fr_1fr] md:gap-4">
      <div className="cartao p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-x-4">
          <div>
            <p className="rotulo">Faturamento do dia</p>
            <p className="mt-1 text-4xl font-extrabold md:text-5xl">{reais(r.faturamento)}</p>
          </div>
          <p className="text-sm text-sec">
            {r.vendas} {r.vendas === 1 ? 'venda' : 'vendas'}
            {r.descontos !== 0 && ` · descontos ${reais(r.descontos)}`}
          </p>
        </div>
        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-borda" aria-hidden>
          <div className="h-full bg-positivo" style={{ width: `${(r.recebido / base) * 100}%` }} />
          <div className="h-full bg-alerta" style={{ width: `${(r.aReceber / base) * 100}%` }} />
          <div className="h-full bg-claro" style={{ width: `${(r.reservadoValor / base) * 100}%` }} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-positivo">
              <span className="size-2.5 rounded-full bg-positivo" /> Recebido
            </p>
            <p className="text-2xl font-extrabold">{reais(r.recebido)}</p>
            <p className="text-xs text-sec">
              Pix {reais(r.porForma.pix)} · Din. {reais(r.porForma.dinheiro)} · Cartão {reais(r.porForma.cartao)}
              {r.porForma.nao_informado > 0 && ` · não informado ${reais(r.porForma.nao_informado)}`}
              {r.fiadoPago > 0 && ` · fiado pago ${reais(r.fiadoPago)}`}
            </p>
          </div>
          <Link to="/fiado" className="-m-2 rounded-xl p-2 hover:bg-alerta/5">
            <p className={`flex items-center gap-2 text-sm font-semibold ${r.aReceber ? 'text-alerta' : 'text-sec'}`}>
              <span className="size-2.5 rounded-full bg-alerta" /> Fiado a receber
            </p>
            <p className={`text-2xl font-extrabold ${r.aReceber ? 'text-alerta' : ''}`}>{reais(r.aReceber)}</p>
            <p className="truncate text-xs text-sec">{devedores.length ? devedores.join(', ') : 'ninguém devendo deste dia'}</p>
          </Link>
          <div>
            <p className={`flex items-center gap-2 text-sm font-semibold ${r.reservas ? 'text-claro' : 'text-sec'}`}>
              <span className="size-2.5 rounded-full bg-claro" /> Reservado
            </p>
            <p className={`text-2xl font-extrabold ${r.reservas ? 'text-claro' : ''}`}>{reais(r.reservadoValor)}</p>
            <p className="text-xs text-sec">{r.reservas ? `${r.reservas} reserva(s) · ${r.reservadoUnidades} un.` : 'nenhuma reserva'}</p>
          </div>
        </div>
      </div>
      <div className="cartao flex flex-col justify-between gap-3 p-4 md:p-6">
        <div>
          <p className="rotulo">Itens vendidos</p>
          <p className="mt-1 text-3xl font-extrabold md:text-4xl">{r.unidades}</p>
        </div>
        {r.disponivel !== null ? (
          <div>
            <Barra valor={r.itens.filter((i) => i.restante !== null).reduce((s, i) => s + i.vendido, 0)} total={r.itens.reduce((s, i) => s + (i.produzido ?? 0), 0)} />
            <p className="mt-2 text-sm text-sec">{r.disponivel} disponíveis nos produtos com estoque</p>
          </div>
        ) : (
          <p className="text-sm text-sec">Produtos sem controle de estoque</p>
        )}
      </div>
    </section>
  )
}

function CartaoProduto({ linha, diaId, online }: { linha: LinhaProduto; diaId: string; online: boolean }) {
  const baixo = estoqueBaixo(linha.restante, linha.produzido)
  const esgotado = linha.restante !== null && linha.restante <= 0
  return (
    <Link
      to={`/dia/${diaId}/venda?produto=${linha.id}`}
      className={`cartao num flex flex-col gap-2 p-4 transition hover:border-destaque/70 active:scale-[0.99] ${baixo ? 'border-alerta/50' : ''} ${
        online ? '' : 'pointer-events-none opacity-50'
      }`}
    >
      <div className="min-w-0">
        <h3 className="font-bold leading-tight">{linha.nome}</h3>
        <p className="text-sm text-claro">
          {reais(linha.preco)} <span className="text-sec">/ {linha.unidade}</span>
        </p>
      </div>
      <div className="mt-auto">
        {linha.restante === null ? (
          <p className="text-sm text-sec">sem limite de estoque</p>
        ) : (
          <p className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-extrabold ${linha.restante < 0 || esgotado ? 'text-alerta' : ''}`}>{linha.restante}</span>
            <span className={`text-sm ${baixo ? 'text-alerta' : 'text-sec'}`}>{esgotado ? 'esgotado' : `de ${linha.produzido}`}</span>
          </p>
        )}
      </div>
      {linha.produzido !== null && <Barra valor={linha.vendido + linha.reservado} total={linha.produzido} baixo={baixo} />}
      <p className="text-xs text-sec">
        {linha.vendido} vendido(s){linha.reservado ? ` · ${linha.reservado} reserv.` : ''} · {reais(linha.faturado)}
      </p>
    </Link>
  )
}

function DiaAberto({ d, r, ehHoje, onMudou }: { d: DiaCompleto; r: ResumoDia; ehHoje: boolean; onMudou: () => void }) {
  const online = useOnline()
  const reservas = d.pedidos.filter((p) => p.status === 'reservado')
  const semOnline = online ? '' : 'pointer-events-none opacity-50'

  return (
    <Pagina largura="max-w-6xl" comNav>
      <Cabecalho d={d} ehHoje={ehHoje}>
        <Link to={`/dia/${d.dia.id}/produtos`} className={`btn-secundario ${semOnline}`}>
          <Icone nome="caixa" tamanho={18} /> Produtos do dia
        </Link>
        <Link to={`/dia/${d.dia.id}/fechar`} className={`btn-secundario ${semOnline}`}>
          <Icone nome="cadeado" tamanho={18} /> Fechar o dia
        </Link>
      </Cabecalho>

      {!ehHoje && (
        <div className="mb-4">
          <Aviso tipo="info">
            Você está trabalhando no dia {dataLonga(d.dia.data)}. As vendas novas entram com a data desse dia. Quando terminar, toque em
            Fechar o dia.
          </Aviso>
        </div>
      )}

      <PainelValores d={d} r={r} />

      {reservas.length > 0 && (
        <section className="cartao mt-4 border-claro/40 p-4 md:p-5">
          <h2 className="mb-1 text-lg font-bold text-claro">Reservas para entregar</h2>
          <ul className="divide-y divide-borda/60">
            {reservas.map((p) => (
              <li key={p.id} className="num flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.cliente}</p>
                  <p className="truncate text-sm text-sec">
                    {descreverPedido(p, d)} · {reais(p.total)}
                  </p>
                </div>
                <Link to={`/venda/${p.id}`} className={`btn-primario shrink-0 px-4 ${semOnline}`}>
                  Entregar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-lg font-bold">Produtos do dia</h2>
          <p className="text-sm text-sec">Toque para vender</p>
        </div>
        {d.itens.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {r.itens.map((l) => (
              <CartaoProduto key={l.id} linha={l} diaId={d.dia.id} online={online} />
            ))}
          </div>
        ) : (
          <Aviso tipo="info">
            Nenhum produto neste dia.{' '}
            <Link to={`/dia/${d.dia.id}/produtos`} className="font-bold underline">
              Adicionar produtos
            </Link>
          </Aviso>
        )}
      </section>

      <section className="cartao mt-6 p-4 md:p-6">
        <h2 className="mb-1 text-lg font-bold">Vendas do dia</h2>
        <ListaVendas d={d} aberto onMudou={onMudou} />
      </section>

      <ExcluirDia diaId={d.dia.id} data={d.dia.data} vendas={r.vendas} />

      <Rodape comNav>
        <Link to={`/dia/${d.dia.id}/venda`} className={`btn-primario min-h-14 w-full text-lg ${d.itens.length ? '' : 'pointer-events-none opacity-50'} ${semOnline}`}>
          <Icone nome="mais" /> Nova venda
        </Link>
      </Rodape>
    </Pagina>
  )
}

function DiaFechado({ d, r, ehHoje, onMudou }: { d: DiaCompleto; r: ResumoDia; ehHoje: boolean; onMudou: () => void }) {
  const nav = useNavigate()
  const online = useOnline()
  const [reabrir, setReabrir] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const grupos = vendasPorProduto(d)

  async function confirmarReabrir() {
    setOcupado(true)
    try {
      await reabrirDia(d.dia.id)
      onMudou()
      nav(ehHoje ? '/' : `/dia/${d.dia.id}`, { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setOcupado(false)
      setReabrir(false)
    }
  }

  return (
    <Pagina largura="max-w-3xl" comNav>
      <Cabecalho d={d} ehHoje={ehHoje} />
      <div className="num space-y-3">
        <section className={`cartao p-5 ${r.lucro < 0 ? 'border-alerta/40' : 'border-positivo/30 bg-gradient-to-br from-[#0D2A2E] to-cartao'}`}>
          <p className={`rotulo ${r.lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>Lucro do dia</p>
          <p className={`mt-1 text-4xl font-extrabold ${r.lucro < 0 ? 'text-alerta' : 'text-positivo'}`}>{reais(r.lucro)}</p>
          <p className="mt-1 text-sm text-sec">
            Faturamento {reais(r.faturamento)} − gasto {d.dia.semGasto ? 'N/A' : reais(r.gasto)} · margem {porcentagem(r.margem)}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Caixa titulo="Recebido" valor={reais(r.recebido)} sub={r.fiadoPago ? `inclui fiado pago ${reais(r.fiadoPago)}` : 'Pix, dinheiro, cartão'} />
          <Caixa titulo="Fiado a receber" valor={reais(r.aReceber)} sub={r.porForma.fiado ? `de ${reais(r.porForma.fiado)} vendido fiado` : 'sem fiado'} cor={r.aReceber ? 'text-alerta' : ''} />
          <Caixa titulo="Vendas" valor={String(r.vendas)} sub={`${r.unidades} itens`} />
          <Caixa titulo="Descontos" valor={reais(r.descontos)} sub={r.bruto ? `${porcentagem(r.descontos / r.bruto)} do bruto` : '—'} />
        </div>

        <section className="cartao space-y-1.5 p-4">
          <p className="rotulo mb-1">Por forma de pagamento</p>
          {(['pix', 'dinheiro', 'cartao', 'fiado', 'nao_informado'] as const)
            .filter((k) => k !== 'nao_informado' || r.porForma[k] > 0)
            .map((k) => (
              <div key={k} className="flex justify-between">
                <span className="text-sec">{ROTULO_PAGAMENTO[k]}</span>
                <span className="font-bold">{reais(r.porForma[k])}</span>
              </div>
            ))}
        </section>

        {grupos.map((g) => (
          <section key={g.itemDiaId} className="cartao p-4">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">{g.produto}</h2>
              <p className="text-sm text-sec">
                {g.quantidade} {g.unidade} · <strong className="text-texto">{reais(g.valor)}</strong>
              </p>
            </div>
            <ul className="divide-y divide-borda/60">
              {g.linhas.map((l, i) => (
                <li key={`${l.pedidoId}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="w-12 shrink-0 text-sec">{hora(l.hora)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.cliente ?? 'Sem nome'}</span>
                  <span className="shrink-0 text-sec">{l.quantidade}×</span>
                  <span className="w-20 shrink-0 text-right font-bold">{reais(l.valor)}</span>
                  <span className="w-32 shrink-0 text-right">
                    <SeloPagamento p={{ status: 'concluido', pagamento: l.pagamento, fiadoPagoEm: l.fiadoPagoEm, fiadoPagoCom: l.fiadoPagoCom }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {erro && <Aviso>{erro}</Aviso>}
        <Link to={`/dia/${d.dia.id}/imagem`} className="btn-primario min-h-14 w-full text-lg">
          <Icone nome="imagem" /> Ver e compartilhar imagens
        </Link>
        <button type="button" className="btn-secundario min-h-12 w-full" onClick={() => setReabrir(true)} disabled={!online}>
          <Icone nome="lapis" tamanho={18} /> Reabrir para corrigir
        </button>
      </div>

      <ExcluirDia diaId={d.dia.id} data={d.dia.data} vendas={r.vendas} />

      <Confirmar
        aberto={reabrir}
        titulo="Reabrir este dia?"
        confirmar="Reabrir"
        ocupado={ocupado}
        onConfirmar={confirmarReabrir}
        onCancelar={() => setReabrir(false)}
      >
        O dia volta a aceitar vendas, correções e mudanças nos produtos. Quando terminar, feche de novo. O gasto informado fica guardado.
      </Confirmar>
    </Pagina>
  )
}

function Caixa({ titulo, valor, sub, cor = '' }: { titulo: string; valor: string; sub: string; cor?: string }) {
  return (
    <div className="cartao p-4">
      <p className={`rotulo ${cor}`}>{titulo}</p>
      <p className={`mt-1 text-2xl font-extrabold ${cor}`}>{valor}</p>
      <p className="mt-1 text-xs text-sec">{sub}</p>
    </div>
  )
}

/** Excluir o dia inteiro, com confirmação explícita (não dá para desfazer). */
function ExcluirDia({ diaId, data, vendas }: { diaId: string; data: string; vendas: number }) {
  const nav = useNavigate()
  const online = useOnline()
  const [aberto, setAberto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function excluir() {
    setOcupado(true)
    setErro(null)
    try {
      await excluirDia(diaId)
      nav('/historico', { replace: true })
    } catch (e) {
      setErro(mensagemErro(e))
      setOcupado(false)
      setAberto(false)
    }
  }

  return (
    <div className="mt-8 border-t border-borda/60 pt-4">
      {erro && (
        <div className="mb-2">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      <button type="button" className="btn min-h-11 w-full text-sm text-sec hover:text-alerta md:w-auto" onClick={() => setAberto(true)} disabled={!online}>
        <Icone nome="lixo" tamanho={16} /> Excluir este dia
      </button>
      <Confirmar
        aberto={aberto}
        titulo={`Excluir o dia ${data.split('-').reverse().join('/')}?`}
        confirmar="Excluir para sempre"
        perigo
        ocupado={ocupado}
        onConfirmar={excluir}
        onCancelar={() => setAberto(false)}
      >
        Apaga o dia inteiro{vendas ? `, com ${vendas} ${vendas === 1 ? 'venda' : 'vendas'}` : ''}, reservas e fiados desse dia. Some também do
        relatório. <strong className="text-alerta">Não dá para desfazer.</strong>
      </Confirmar>
    </div>
  )
}
