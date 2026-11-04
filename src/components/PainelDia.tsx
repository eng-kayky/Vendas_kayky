import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { excluirDia, mensagemErro, reabrirDia } from '../lib/api'
import { dataLonga, diaDaSemana, diaMes, hojeBelem, hora } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { estoqueBaixo, resumirDia, vendasPorProduto, type LinhaProduto, type ResumoDia } from '../lib/calculos'
import { ROTULO_PAGAMENTO, type DiaCompleto } from '../lib/tipos'
import { useOnline } from '../hooks'
import ListaVendas, { descreverPedido, SeloPagamento } from './ListaVendas'
import { Aviso, Barra, Confirmar, Icone, Indicador, Pagina, Rodape, Secao, Selo } from './ui'

/** Painel de um dia: trabalhar (aberto) ou ver o resumo (fechado). Serve para hoje e dias anteriores. */
export default function PainelDia({ d, onMudou }: { d: DiaCompleto; onMudou: () => void }) {
  const r = resumirDia(d)
  const ehHoje = d.dia.data === hojeBelem()
  return d.dia.status === 'aberto' ? (
    <DiaAberto d={d} r={r} ehHoje={ehHoje} onMudou={onMudou} />
  ) : (
    <DiaFechado d={d} r={r} ehHoje={ehHoje} onMudou={onMudou} />
  )
}

// ---------------------------------------------------------------- peças comuns

function Cabecalho({ d, ehHoje }: { d: DiaCompleto; ehHoje: boolean }) {
  return (
    <header className="pb-4 pt-2 md:pb-6">
      <p className="text-sm text-sec">
        {diaDaSemana(d.dia.data)}, {diaMes(d.dia.data)}
      </p>
      <h1 className="flex flex-wrap items-center gap-2 text-3xl font-extrabold md:text-4xl">
        {ehHoje ? 'Hoje' : dataLonga(d.dia.data).split(', ')[1]}
        {d.dia.status === 'aberto' ? <Selo cor="positivo">Dia aberto</Selo> : <Selo>Dia fechado</Selo>}
      </h1>
    </header>
  )
}

/** Duas colunas no computador (conteúdo + painel lateral que acompanha a rolagem); uma no celular. */
function Colunas({ principal, lateral }: { principal: ReactNode; lateral: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <div className="order-2 min-w-0 space-y-4 lg:order-1">{principal}</div>
      <aside className="order-1 space-y-4 lg:sticky lg:top-24 lg:order-2">{lateral}</aside>
    </div>
  )
}

/** Faturamento do dia e para onde foi: recebido · fiado a receber · reservado. */
function Resumo({ d, r }: { d: DiaCompleto; r: ResumoDia }) {
  const base = Math.max(1, r.recebido + r.aReceber + r.reservadoValor)
  const devedores = [...new Set(d.pedidos.filter((p) => p.status === 'concluido' && p.pagamento === 'fiado' && !p.fiadoPagoEm).map((p) => p.cliente))]
  return (
    <section className="painel p-5">
      <Indicador
        rotulo="Faturamento do dia"
        valor={reais(r.faturamento)}
        grande
        sub={`${r.vendas} ${r.vendas === 1 ? 'venda' : 'vendas'} · ${r.unidades} itens${r.descontos ? ` · descontos ${reais(r.descontos)}` : ''}`}
      />
      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-borda" aria-hidden>
        <div className="h-full bg-positivo" style={{ width: `${(r.recebido / base) * 100}%` }} />
        <div className="h-full bg-alerta" style={{ width: `${(r.aReceber / base) * 100}%` }} />
        <div className="h-full bg-claro" style={{ width: `${(r.reservadoValor / base) * 100}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-4">
        <Indicador
          rotulo="Recebido"
          ponto="positivo"
          valor={reais(r.recebido)}
          sub={
            <>
              <span className="hidden lg:inline">
                Pix {reais(r.porForma.pix)} · Dinheiro {reais(r.porForma.dinheiro)} · Cartão {reais(r.porForma.cartao)}
                {r.porForma.nao_informado > 0 && ` · não informado ${reais(r.porForma.nao_informado)}`}
              </span>
              {r.fiadoPago > 0 && <span className="block">inclui fiado pago {reais(r.fiadoPago)}</span>}
            </>
          }
        />
        <Link to="/fiado" className="-m-2 rounded-xl p-2 transition hover:bg-alerta/5">
          <Indicador
            rotulo="A receber"
            ponto="alerta"
            cor={r.aReceber ? 'alerta' : 'texto'}
            valor={reais(r.aReceber)}
            sub={<span className="line-clamp-2">{devedores.length ? devedores.join(', ') : 'ninguém devendo'}</span>}
          />
        </Link>
        <Indicador
          rotulo="Reservado"
          ponto="claro"
          cor={r.reservas ? 'claro' : 'texto'}
          valor={reais(r.reservadoValor)}
          sub={r.reservas ? `${r.reservas} reserva(s)` : 'nenhuma'}
        />
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
      className={`cartao num group flex min-h-36 flex-col gap-2 p-4 transition hover:-translate-y-0.5 hover:border-destaque/70 hover:bg-elevado ${
        baixo ? 'border-alerta/50' : ''
      } ${online ? '' : 'pointer-events-none opacity-50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold leading-tight">{linha.nome}</h3>
          <p className="text-sm text-claro">
            {reais(linha.preco)} <span className="text-sec">/ {linha.unidade}</span>
          </p>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-destaque/15 text-claro transition group-hover:bg-destaque group-hover:text-fundo" aria-hidden>
          <Icone nome="mais" tamanho={16} />
        </span>
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

// ---------------------------------------------------------------- dia aberto

function DiaAberto({ d, r, ehHoje, onMudou }: { d: DiaCompleto; r: ResumoDia; ehHoje: boolean; onMudou: () => void }) {
  const online = useOnline()
  const reservas = d.pedidos.filter((p) => p.status === 'reservado')
  const semOnline = online ? '' : 'pointer-events-none opacity-50'
  const podeVender = d.itens.length > 0

  const acoes = (
    <div className="grid grid-cols-2 gap-2">
      <Link to={`/dia/${d.dia.id}/produtos`} className={`btn-secundario ${semOnline}`}>
        <Icone nome="caixa" tamanho={18} /> Produtos
      </Link>
      <Link to={`/dia/${d.dia.id}/fechar`} className={`btn-secundario ${semOnline}`}>
        <Icone nome="cadeado" tamanho={18} /> Fechar dia
      </Link>
    </div>
  )

  return (
    <Pagina largura="max-w-6xl" comNav>
      <Cabecalho d={d} ehHoje={ehHoje} />
      {!ehHoje && (
        <div className="mb-4">
          <Aviso tipo="info">Você está trabalhando num dia que já passou. As vendas novas entram com a data dele. Quando terminar, feche o dia.</Aviso>
        </div>
      )}

      <Colunas
        lateral={
          <>
            <Resumo d={d} r={r} />
            <div className="hidden space-y-2 lg:block">
              <Link to={`/dia/${d.dia.id}/venda`} className={`btn-primario min-h-14 w-full text-lg ${podeVender ? '' : 'pointer-events-none opacity-50'} ${semOnline}`}>
                <Icone nome="mais" /> Nova venda
              </Link>
              {acoes}
            </div>
            <div className="lg:hidden">{acoes}</div>
          </>
        }
        principal={
          <>
            {reservas.length > 0 && (
              <Secao titulo="Reservas para entregar" sub="Quando o cliente buscar, toque em Entregar" className="border-claro/40">
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
              </Secao>
            )}

            <section>
              <div className="mb-3 flex items-end justify-between gap-3 px-1">
                <div>
                  <h2 className="text-lg font-bold">Produtos do dia</h2>
                  {r.disponivel !== null && <p className="text-xs text-sec">{r.disponivel} disponíveis nos produtos com estoque</p>}
                </div>
                <p className="text-xs text-sec">toque para vender</p>
              </div>
              {podeVender ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

            <Secao titulo="Vendas do dia" sub={r.vendas ? `${r.vendas} ${r.vendas === 1 ? 'venda' : 'vendas'}, a mais recente primeiro` : undefined}>
              <ListaVendas d={d} aberto onMudou={onMudou} />
            </Secao>

            <ExcluirDia diaId={d.dia.id} data={d.dia.data} vendas={r.vendas} />

            <div className="lg:hidden">
              <Rodape comNav>
                <Link to={`/dia/${d.dia.id}/venda`} className={`btn-primario min-h-14 w-full text-lg ${podeVender ? '' : 'pointer-events-none opacity-50'} ${semOnline}`}>
                  <Icone nome="mais" /> Nova venda
                </Link>
              </Rodape>
            </div>
          </>
        }
      />
    </Pagina>
  )
}

// ---------------------------------------------------------------- dia fechado

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
    <Pagina largura="max-w-6xl" comNav>
      <Cabecalho d={d} ehHoje={ehHoje} />
      <Colunas
        lateral={
          <>
            <section className={`painel p-5 ${r.lucro < 0 ? 'border-alerta/40' : 'border-positivo/30 bg-gradient-to-br from-[#0D2A2E] to-elevado'}`}>
              <Indicador rotulo="Lucro do dia" valor={reais(r.lucro)} grande cor={r.lucro < 0 ? 'alerta' : 'positivo'} sub={`margem ${porcentagem(r.margem)}`} />
              <dl className="num mt-4 space-y-1.5 border-t border-borda/60 pt-4 text-sm">
                <Linha r="Faturamento" v={reais(r.faturamento)} />
                <Linha r="Gasto com material" v={d.dia.semGasto ? 'N/A' : `− ${reais(r.gasto)}`} />
                <Linha r="Recebido" v={reais(r.recebido)} />
                {r.aReceber > 0 && <Linha r="Fiado a receber" v={reais(r.aReceber)} cor="text-alerta" />}
                {r.descontos !== 0 && <Linha r="Descontos" v={reais(r.descontos)} />}
                <Linha r="Vendas · itens" v={`${r.vendas} · ${r.unidades}`} />
              </dl>
            </section>
            <Secao titulo="Por forma de pagamento">
              <dl className="num space-y-1.5 text-sm">
                {(['pix', 'dinheiro', 'cartao', 'fiado', 'nao_informado'] as const)
                  .filter((k) => k !== 'nao_informado' || r.porForma[k] > 0)
                  .map((k) => (
                    <Linha key={k} r={ROTULO_PAGAMENTO[k]} v={reais(r.porForma[k])} />
                  ))}
              </dl>
            </Secao>
            <div className="space-y-2">
              {erro && <Aviso>{erro}</Aviso>}
              <Link to={`/dia/${d.dia.id}/imagem`} className="btn-primario min-h-14 w-full text-lg">
                <Icone nome="imagem" /> Imagens para compartilhar
              </Link>
              <button type="button" className="btn-secundario min-h-12 w-full" onClick={() => setReabrir(true)} disabled={!online}>
                <Icone nome="lapis" tamanho={18} /> Reabrir para corrigir
              </button>
            </div>
          </>
        }
        principal={
          <>
            {!grupos.length && <Aviso tipo="info">Nenhuma venda neste dia.</Aviso>}
            {grupos.map((g) => (
              <Secao key={g.itemDiaId} titulo={g.produto} acao={<p className="num shrink-0 text-sm text-sec">{g.quantidade} {g.unidade} · <strong className="text-texto">{reais(g.valor)}</strong></p>}>
                <ul className="num divide-y divide-borda/60">
                  {g.linhas.map((l, i) => (
                    <li key={`${l.pedidoId}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-11 shrink-0 text-sec">{hora(l.hora)}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.cliente ?? 'Sem nome'}</span>
                      <span className="shrink-0 text-sec">{l.quantidade}×</span>
                      <span className="w-20 shrink-0 text-right font-bold">{reais(l.valor)}</span>
                      <span className="hidden w-36 shrink-0 text-right sm:block">
                        <SeloPagamento p={{ status: 'concluido', pagamento: l.pagamento, fiadoPagoEm: l.fiadoPagoEm, fiadoPagoCom: l.fiadoPagoCom }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Secao>
            ))}
            <ExcluirDia diaId={d.dia.id} data={d.dia.data} vendas={r.vendas} />
          </>
        }
      />

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

function Linha({ r, v, cor = '' }: { r: string; v: string; cor?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-sec">{r}</dt>
      <dd className={`font-semibold ${cor}`}>{v}</dd>
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
    <div className="pt-2">
      {erro && (
        <div className="mb-2">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      <button type="button" className="btn-fantasma min-h-10 px-2 text-sm hover:text-alerta" onClick={() => setAberto(true)} disabled={!online}>
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
