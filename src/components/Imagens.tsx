// Imagens 1080×1350 para compartilhar: resumo do dia, vendas do dia por produto e relatório do período.
// Calculadas na hora a partir dos dados (corrigiu uma venda, a imagem já sai certa).
import { forwardRef, type CSSProperties, type ReactNode } from 'react'
import { toPng } from 'html-to-image'
import { dataCurta, diaDaSemana, hora } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { nomePeriodo, paginarGrupos, vendasPorProduto, type BlocoPagina, type Periodo, type Relatorio, type ResumoDia } from '../lib/calculos'
import { ROTULO_PAGAMENTO, type DiaCompleto } from '../lib/tipos'

export const LARGURA = 1080
export const ALTURA = 1350

const C = {
  fundo: '#060C22',
  cartao: '#0D1735',
  borda: '#1B2A5C',
  destaque: '#4B8DFF',
  texto: '#EEF2FF',
  sec: '#9DB0DC',
  alerta: '#FF9AA8',
  positivo: '#3DDC97',
  claro: '#8AB4FF',
}
const rotulo: CSSProperties = { fontSize: 18, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.sec }
const cartao: CSSProperties = { background: C.cartao, border: `1px solid ${C.borda}`, borderRadius: 24 }
const corDe = (v: number) => (v < 0 ? C.alerta : C.positivo)
const curto: Record<string, string> = { pix: 'Pix', dinheiro: 'Din.', cartao: 'Cartão' }

/** Moldura comum: fundo, cabeçalho com a marca e a data, rodapé. */
const Moldura = forwardRef<HTMLDivElement, { titulo: string; sub: string; direita: ReactNode; rodape?: ReactNode; children: ReactNode }>(function Moldura(
  { titulo, sub, direita, rodape, children },
  ref,
) {
  return (
    <div
      ref={ref}
      style={{
        width: LARGURA,
        height: ALTURA,
        boxSizing: 'border-box',
        padding: '54px 60px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        fontFamily: 'Inter, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        color: C.texto,
        background: `radial-gradient(120% 70% at 50% 0%, #0B1638 0%, ${C.fundo} 75%)`,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{ width: 72, height: 72, borderRadius: 18, background: C.destaque, color: C.fundo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}
          >
            CV
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{titulo}</div>
            <div style={{ fontSize: 22, color: C.sec, marginTop: 4 }}>{sub}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>{direita}</div>
      </div>
      {children}
      {rodape && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: C.sec }}>{rodape}</div>}
    </div>
  )
})

function DataDireita({ data }: { data: string }) {
  return (
    <>
      <div style={{ fontSize: 22, color: C.sec }}>{diaDaSemana(data)}</div>
      <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1.05 }}>{dataCurta(data)}</div>
    </>
  )
}

function Indicador({ t, v, s, cor = C.texto }: { t: string; v: string; s: string; cor?: string }) {
  return (
    <div style={{ ...cartao, flex: 1, padding: '18px 20px', minWidth: 0 }}>
      <div style={{ ...rotulo, fontSize: 15, minHeight: 36 }}>{t}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: cor, whiteSpace: 'nowrap', marginTop: 4 }}>{v}</div>
      <div style={{ fontSize: 17, color: C.sec, marginTop: 4 }}>{s}</div>
    </div>
  )
}

function FaixaFormas({ porForma, fiado }: { porForma: ResumoDia['porForma']; fiado: number }) {
  const formas = (['pix', 'dinheiro', 'cartao', 'nao_informado'] as const).filter((k) => k !== 'nao_informado' || porForma[k] > 0)
  return (
    <div style={{ ...cartao, padding: '18px 30px', display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ ...rotulo, fontSize: 16, width: 110 }}>Por forma</div>
      {formas.map((k) => (
        <div key={k} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, color: C.sec }}>{ROTULO_PAGAMENTO[k]}</div>
          <div style={{ fontSize: 27, fontWeight: 800, whiteSpace: 'nowrap' }}>{reais(porForma[k])}</div>
        </div>
      ))}
      {fiado > 0 && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, color: C.alerta }}>Fiado</div>
          <div style={{ fontSize: 27, fontWeight: 800, whiteSpace: 'nowrap', color: C.alerta }}>{reais(fiado)}</div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 1. resumo do dia

export const ImagemResumo = forwardRef<HTMLDivElement, { d: DiaCompleto; r: ResumoDia }>(function ImagemResumo({ d, r }, ref) {
  const vendidos = r.itens.filter((i) => i.vendido > 0 || i.produzido)
  const muitos = vendidos.length > 6
  const altLinha = muitos ? Math.max(36, Math.floor(330 / (vendidos.length + 1))) : 54
  const fonte = muitos ? 22 : 27
  const num: CSSProperties = { textAlign: 'right', paddingLeft: 14, whiteSpace: 'nowrap' }
  const comEstoque = vendidos.some((i) => i.produzido !== null)

  return (
    <Moldura
      ref={ref}
      titulo="Controle de Vendas"
      sub="Resumo do dia"
      direita={<DataDireita data={d.dia.data} />}
      rodape={
        <>
          <span>
            {r.vendas} vendas · {r.unidades} itens
          </span>
          <span style={{ color: r.aReceber ? C.alerta : C.sec }}>
            {r.porForma.fiado > 0 ? (r.aReceber ? `Fiado a receber ${reais(r.aReceber)}` : 'Fiado do dia todo pago') : ''}
          </span>
        </>
      }
    >
      <div
        style={{
          ...cartao,
          padding: '28px 44px',
          borderColor: r.lucro < 0 ? 'rgba(255,154,168,0.35)' : 'rgba(61,220,151,0.3)',
          background: `linear-gradient(135deg, ${r.lucro < 0 ? '#2A1020' : '#0D2A2E'} 0%, ${C.cartao} 70%)`,
        }}
      >
        <div style={{ ...rotulo, fontSize: 20, color: corDe(r.lucro) }}>Lucro do dia</div>
        <div style={{ fontSize: 108, fontWeight: 800, lineHeight: 1.05, color: corDe(r.lucro), letterSpacing: '-0.02em' }}>{reais(r.lucro)}</div>
        <div style={{ fontSize: 26, color: C.sec, marginTop: 8 }}>
          {d.dia.semGasto ? (
            'Sem gasto com material no dia'
          ) : (
            <>
              Faturamento − gasto de {reais(r.gasto)} · margem <b style={{ color: C.texto }}>{porcentagem(r.margem)}</b>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <Indicador t="Faturamento" v={reais(r.faturamento)} s={r.descontos ? `descontos ${reais(r.descontos)}` : 'sem descontos'} />
        <Indicador t="Recebido" v={reais(r.recebido)} s={r.fiadoPago ? `inclui fiado pago ${reais(r.fiadoPago)}` : 'Pix, dinheiro, cartão'} />
        <Indicador t="Gasto" v={d.dia.semGasto ? 'N/A' : reais(r.gasto)} s={d.dia.semGasto ? 'não teve gasto' : 'com material'} />
      </div>

      <div style={{ ...cartao, padding: '10px 34px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fonte }}>
          <thead>
            <tr style={{ ...rotulo, height: 48 }}>
              <th style={{ textAlign: 'left', fontWeight: 600 }}>Produto</th>
              {comEstoque && <th style={{ ...num, fontWeight: 600 }}>Tinha</th>}
              <th style={{ ...num, fontWeight: 600 }}>Vend.</th>
              {comEstoque && <th style={{ ...num, fontWeight: 600 }}>Sobra</th>}
              <th style={{ ...num, fontWeight: 600 }}>Faturado</th>
            </tr>
          </thead>
          <tbody>
            {vendidos.map((i) => (
              <tr key={i.id} style={{ height: altLinha, borderTop: `1px solid ${C.borda}` }}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 380 }}>{i.nome}</td>
                {comEstoque && <td style={num}>{i.produzido ?? '—'}</td>}
                <td style={num}>{i.vendido}</td>
                {comEstoque && <td style={{ ...num, color: (i.restante ?? 0) < 0 ? C.alerta : C.texto }}>{i.restante ?? '—'}</td>}
                <td style={{ ...num, fontWeight: 700 }}>{reais(i.faturado)}</td>
              </tr>
            ))}
            <tr style={{ height: altLinha, borderTop: `1px solid ${C.borda}`, fontWeight: 800 }}>
              <td>Total</td>
              {comEstoque && <td style={num}>{vendidos.reduce((s, i) => s + (i.produzido ?? 0), 0) || '—'}</td>}
              <td style={num}>{r.unidades}</td>
              {comEstoque && <td style={num}>{r.disponivel ?? '—'}</td>}
              <td style={num}>{reais(r.faturamento)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <FaixaFormas porForma={r.porForma} fiado={r.porForma.fiado} />
    </Moldura>
  )
})

// ---------------------------------------------------------------- 2. vendas do dia, por produto

const LINHAS_PRIMEIRA = 20
const LINHAS_DEMAIS = 26

/** Páginas da lista de vendas (normalmente uma só). A linha de totais por produto ocupa ~1 linha a cada 2 produtos. */
export function paginasDeVendas(d: DiaCompleto) {
  const grupos = vendasPorProduto(d)
  const linhasDeTotais = Math.ceil(grupos.length / 2)
  return paginarGrupos(grupos, { primeira: LINHAS_PRIMEIRA - (linhasDeTotais - 1), demais: LINHAS_DEMAIS })
}

export const ImagemVendas = forwardRef<HTMLDivElement, { d: DiaCompleto; r: ResumoDia; blocos: BlocoPagina[]; pagina: number; total: number }>(function ImagemVendas(
  { d, r, blocos, pagina, total },
  ref,
) {
  const grupos = vendasPorProduto(d)
  const td: CSSProperties = { padding: '0 6px', fontSize: 22, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  return (
    <Moldura
      ref={ref}
      titulo="Vendas do dia"
      sub={`Controle de Vendas · ${r.vendas} vendas${total > 1 ? ` · parte ${pagina} de ${total}` : ''}`}
      direita={<DataDireita data={d.dia.data} />}
      rodape={
        <>
          <span>
            Pix {reais(r.porForma.pix)} · Dinheiro {reais(r.porForma.dinheiro)} · Cartão {reais(r.porForma.cartao)}
            {r.porForma.fiado ? ` · Fiado ${reais(r.porForma.fiado)}` : ''}
          </span>
          <span>{total > 1 ? `${pagina}/${total}` : ''}</span>
        </>
      }
    >
      {pagina === 1 && (
        <>
          <div style={{ display: 'flex', gap: 14 }}>
            <Indicador t="Faturamento" v={reais(r.faturamento)} s={`${r.unidades} itens`} />
            <Indicador t="Recebido" v={reais(r.recebido)} s="Pix, dinheiro, cartão" />
            <Indicador t="Fiado a receber" v={reais(r.aReceber)} s={r.fiadoPago ? `já pago ${reais(r.fiadoPago)}` : r.porForma.fiado ? 'nada pago ainda' : 'sem fiado'} cor={r.aReceber ? C.alerta : C.texto} />
            <Indicador t="Vendas" v={String(r.vendas)} s={`${grupos.length} produto(s)`} />
          </div>
          <div style={{ ...cartao, padding: '14px 22px', display: 'flex', flexWrap: 'wrap', gap: '8px 28px' }}>
            {grupos.map((g) => (
              <div key={g.itemDiaId} style={{ fontSize: 21 }}>
                <b>{g.produto}</b>
                <span style={{ color: C.sec }}>
                  {' '}
                  · {g.quantidade} {g.unidade} · {reais(g.valor)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {blocos.map((b) => (
          <div key={`${b.grupo.itemDiaId}-${b.linhas[0]?.pedidoId}`} style={{ ...cartao, borderRadius: 22, padding: '12px 20px 6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 6px 6px' }}>
              <div style={{ fontSize: 25, fontWeight: 800 }}>
                {b.grupo.produto}
                {b.continuacao && <span style={{ fontSize: 18, fontWeight: 500, color: C.sec }}> (continuação)</span>}
              </div>
              <div style={{ fontSize: 20, color: C.sec }}>
                {b.grupo.quantidade} {b.grupo.unidade} · <b style={{ color: C.texto }}>{reais(b.grupo.valor)}</b>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 80 }} />
                <col />
                <col style={{ width: 70 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 250 }} />
              </colgroup>
              <tbody>
                {b.linhas.map((l, i) => {
                  const fiado = l.pagamento === 'fiado'
                  return (
                    <tr key={`${l.pedidoId}-${i}`} style={{ height: 39, borderTop: `1px solid ${C.borda}` }}>
                      <td style={{ ...td, color: C.sec }}>{hora(l.hora)}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{l.cliente ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: C.sec }}>{l.quantidade}×</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{reais(l.valor)}</td>
                      <td style={{ ...td, paddingLeft: 18, fontSize: fiado ? 19 : 22, fontWeight: fiado ? 700 : 400, color: fiado ? (l.fiadoPagoEm ? C.positivo : C.alerta) : C.texto }}>
                        {fiado
                          ? l.fiadoPagoEm
                            ? `Fiado pago ${curto[l.fiadoPagoCom!]} ${dataCurta(l.fiadoPagoEm).slice(0, 5)}`
                            : 'Fiado · a receber'
                          : ROTULO_PAGAMENTO[l.pagamento]}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Moldura>
  )
})

// ---------------------------------------------------------------- 3. relatório do período

export const ImagemRelatorio = forwardRef<HTMLDivElement, { r: Relatorio; periodo: Periodo }>(function ImagemRelatorio({ r, periodo }, ref) {
  const maxDia = Math.max(1, ...r.porDia.map((d) => d.faturamento))
  return (
    <Moldura
      ref={ref}
      titulo="Controle de Vendas"
      sub={`Relatório ${periodo.tipo === 'semana' ? 'da semana' : 'do mês'}`}
      direita={<div style={{ fontSize: 40, fontWeight: 800 }}>{nomePeriodo(periodo)}</div>}
      rodape={
        <>
          <span>{r.melhorDia ? `Melhor dia: ${dataCurta(r.melhorDia.data)} · ${reais(r.melhorDia.faturamento)}` : ''}</span>
          <span>{r.ticketMedio ? `Ticket médio ${reais(r.ticketMedio)}` : `${r.vendas} vendas`}</span>
        </>
      }
    >
      <div
        style={{
          ...cartao,
          padding: '26px 44px',
          borderColor: r.lucro < 0 ? 'rgba(255,154,168,0.35)' : 'rgba(61,220,151,0.3)',
          background: `linear-gradient(135deg, ${r.lucro < 0 ? '#2A1020' : '#0D2A2E'} 0%, ${C.cartao} 70%)`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <div style={{ ...rotulo, color: corDe(r.lucro) }}>Lucro do período</div>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, color: corDe(r.lucro) }}>{reais(r.lucro)}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 24, color: C.sec, lineHeight: 1.5 }}>
          <div>
            Margem <b style={{ color: C.texto }}>{porcentagem(r.margem)}</b>
          </div>
          <div>{r.dias} dia(s) trabalhado(s)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        <Indicador t="Faturamento" v={reais(r.faturamento)} s={`${r.unidades} itens`} />
        <Indicador t="Recebido" v={reais(r.recebido)} s="inclui fiado pago" />
        <Indicador t="Fiado a receber" v={reais(r.aReceber)} s="destes dias" cor={r.aReceber ? C.alerta : C.texto} />
        <Indicador t="Gasto" v={reais(r.gasto)} s={r.diasSemGasto ? `${r.diasSemGasto} dia(s) N/A` : 'com material'} />
      </div>

      <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
        <div style={{ ...cartao, flex: 1.25, padding: '20px 24px', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ ...rotulo, marginBottom: 8 }}>Por produto</div>
          {r.produtos.slice(0, 7).map((p) => (
            <div key={p.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 22, padding: '8px 0', borderTop: `1px solid ${C.borda}` }}>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <span style={{ color: C.sec }}>
                  {p.vendido} {p.unidade} ·{' '}
                </span>
                <b>{reais(p.faturado)}</b>
              </span>
            </div>
          ))}
          <div style={{ ...rotulo, margin: '20px 0 8px' }}>Clientes que mais compraram</div>
          {r.clientes.slice(0, 5).map((c, i) => (
            <div key={c.nome} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 21, padding: '5px 0' }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ color: C.sec }}>{i + 1}.</span> {c.nome}
              </span>
              <b style={{ whiteSpace: 'nowrap', paddingLeft: 10 }}>{reais(c.total)}</b>
            </div>
          ))}
          {!r.clientes.length && <div style={{ fontSize: 21, color: C.sec }}>Sem nomes registrados.</div>}
        </div>
        <div style={{ ...cartao, flex: 1, padding: '20px 24px', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ ...rotulo, marginBottom: 12 }}>Por dia</div>
          {r.porDia.slice(-12).map((d) => (
            <div key={d.data} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20 }}>
                <span>
                  {dataCurta(d.data).slice(0, 5)} <span style={{ color: C.sec }}>{diaDaSemana(d.data).split('-')[0]}</span>
                </span>
                <b>{reais(d.faturamento)}</b>
              </div>
              <div style={{ height: 9, background: C.borda, borderRadius: 6, marginTop: 5 }}>
                <div style={{ height: 9, width: `${(d.faturamento / maxDia) * 100}%`, background: C.destaque, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <FaixaFormas porForma={r.porForma} fiado={r.porForma.fiado} />
    </Moldura>
  )
})

// ---------------------------------------------------------------- exportar

/** Exporta o nó para PNG (1080×1350, pixelRatio 1). */
export async function gerarPng(no: HTMLElement): Promise<string> {
  await document.fonts.ready
  const opcoes = { width: LARGURA, height: ALTURA, pixelRatio: 1, cacheBust: true, backgroundColor: C.fundo }
  // A primeira chamada às vezes sai sem a fonte (sobretudo no Safari); a segunda vem completa
  await toPng(no, opcoes)
  return toPng(no, opcoes)
}

/** Compartilha os arquivos (Web Share) ou baixa, se o aparelho não suportar. Retorna false se só baixou. */
export async function compartilharOuBaixar(urls: string[], nomes: string[], titulo: string): Promise<boolean> {
  const arquivos = await Promise.all(urls.map(async (u, i) => new File([await (await fetch(u)).blob()], nomes[i], { type: 'image/png' })))
  if (navigator.canShare?.({ files: arquivos })) {
    try {
      await navigator.share({ files: arquivos, title: titulo })
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return true
    }
  }
  baixar(urls, nomes)
  return false
}

export function baixar(urls: string[], nomes: string[]) {
  urls.forEach((u, i) => {
    const a = document.createElement('a')
    a.href = u
    a.download = nomes[i]
    document.body.appendChild(a)
    a.click()
    a.remove()
  })
}
