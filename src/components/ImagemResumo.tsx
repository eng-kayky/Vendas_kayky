import { forwardRef } from 'react'
import { toPng } from 'html-to-image'
import { dataCurta, diaDaSemana, hora } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { agruparPorProduto, paginarGrupos, totaisFiado, type BlocoPagina, type DadosImagem, type SituacaoFiado } from '../lib/resumo'

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
}

const rotulo: React.CSSProperties = { fontSize: 20, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.sec }
const cartao: React.CSSProperties = { background: C.cartao, border: `1px solid ${C.borda}`, borderRadius: 28 }
const corLucro = (v: number) => (v < 0 ? C.alerta : C.positivo)

/** Imagem de resumo do dia (1080×1350), montada só a partir do snapshot. */
const ImagemResumo = forwardRef<HTMLDivElement, { d: DadosImagem; situacao?: SituacaoFiado }>(function ImagemResumo(
  { d, situacao = {} },
  ref,
) {
  const pctDesconto = d.bruto > 0 ? d.descontos / d.bruto : null
  // Dias antigos sem lista: considera todo o fiado como a receber
  const fiado = d.lista.length ? totaisFiado(d.lista, situacao) : { pago: 0, aReceber: d.pagamentos.fiado }
  const muitos = d.itens.length > 4
  const linhaAlt = muitos ? Math.max(40, Math.floor(240 / d.itens.length)) : 60
  const fonteLinha = muitos ? 26 : 30
  const num: React.CSSProperties = { textAlign: 'right', paddingLeft: 16, whiteSpace: 'nowrap' }

  return (
    <div
      ref={ref}
      style={{
        width: LARGURA,
        height: ALTURA,
        boxSizing: 'border-box',
        padding: '60px 72px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        fontFamily: 'Inter, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        color: C.texto,
        background: `radial-gradient(120% 70% at 50% 0%, #0B1638 0%, ${C.fundo} 75%)`,
        overflow: 'hidden',
      }}
    >
      {/* cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: C.destaque,
              color: C.fundo,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            CV
          </div>
          <div>
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>Controle de Vendas</div>
            <div style={{ fontSize: 26, color: C.sec, marginTop: 4 }}>Resumo do dia</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, color: C.sec }}>{diaDaSemana(d.data)}</div>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05 }}>{dataCurta(d.data)}</div>
        </div>
      </div>

      {/* lucro */}
      <div
        style={{
          ...cartao,
          borderColor: d.lucro < 0 ? 'rgba(255,154,168,0.35)' : 'rgba(61,220,151,0.3)',
          background: d.lucro < 0 ? `linear-gradient(135deg, #2A1020 0%, ${C.cartao} 70%)` : `linear-gradient(135deg, #0D2A2E 0%, ${C.cartao} 70%)`,
          padding: '32px 48px',
        }}
      >
        <div style={{ ...rotulo, fontSize: 22, color: corLucro(d.lucro) }}>Lucro do dia</div>
        <div style={{ fontSize: 120, fontWeight: 800, lineHeight: 1.05, color: corLucro(d.lucro), letterSpacing: '-0.02em', marginTop: 4 }}>
          {reais(d.lucro)}
        </div>
        <div style={{ fontSize: 28, color: C.sec, marginTop: 12 }}>
          {d.gasto === null ? (
            'Sem gasto com material no dia'
          ) : (
            <>
              Margem de <b style={{ color: C.texto }}>{porcentagem(d.margem)}</b> sobre o faturamento líquido
            </>
          )}
        </div>
      </div>

      {/* três cartões */}
      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { t: 'Faturamento líquido', v: reais(d.liquido), s: `Bruto ${reais(d.bruto)}`, cor: C.texto },
          {
            t: 'Gasto com material',
            v: d.gasto === null ? 'N/A' : reais(d.gasto),
            s: d.gasto === null ? 'não teve gasto' : d.resumido ? 'informado no fechamento' : `${d.vendas} vendas no dia`,
            cor: C.texto,
          },
          { t: 'Descontos', v: reais(d.descontos), s: `${porcentagem(pctDesconto)} do bruto`, cor: d.descontos > 0 ? C.alerta : C.texto },
        ].map((k) => (
          <div key={k.t} style={{ ...cartao, flex: 1, padding: '28px 30px', minWidth: 0 }}>
            <div style={{ ...rotulo, minHeight: 48 }}>{k.t}</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: k.cor, marginTop: 8, whiteSpace: 'nowrap' }}>{k.v}</div>
            <div style={{ fontSize: 22, color: C.sec, marginTop: 8 }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* tabela */}
      <div style={{ ...cartao, padding: '12px 36px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fonteLinha }}>
          <thead>
            <tr style={{ ...rotulo, height: 52 }}>
              <th style={{ textAlign: 'left', fontWeight: 600 }}>Produto</th>
              <th style={{ ...num, fontWeight: 600 }}>Prod.</th>
              <th style={{ ...num, fontWeight: 600 }}>Vend.</th>
              <th style={{ ...num, fontWeight: 600 }}>Sobra</th>
              <th style={{ ...num, fontWeight: 600 }}>Faturado</th>
            </tr>
          </thead>
          <tbody>
            {d.itens.map((i) => (
              <tr key={i.nome} style={{ height: linhaAlt, borderTop: `1px solid ${C.borda}` }}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 290 }}>{i.nome}</td>
                <td style={num}>{i.produzido}</td>
                <td style={num}>{i.vendido}</td>
                <td style={{ ...num, color: i.sobra < 0 ? C.alerta : C.texto }}>{i.sobra}</td>
                <td style={{ ...num, fontWeight: 700 }}>{reais(i.faturado)}</td>
              </tr>
            ))}
            <tr style={{ height: linhaAlt, borderTop: `1px solid ${C.borda}`, fontWeight: 800 }}>
              <td>Total</td>
              <td style={num}>{d.produzido}</td>
              <td style={num}>{d.vendido}</td>
              <td style={num}>{d.sobra_unidades}</td>
              <td style={num}>{reais(d.liquido)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* recebido por */}
      <div style={{ ...cartao, padding: '26px 40px', display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ ...rotulo, width: 130 }}>Recebido por</div>
        {(
          [
            ['Pix', d.pagamentos.pix],
            ['Dinheiro', d.pagamentos.dinheiro],
            ['Cartão', d.pagamentos.cartao],
            ...(d.pagamentos.fiado > 0 ? ([['Fiado', d.pagamentos.fiado]] as const) : []),
          ] as const
        ).map(([t, v]) => (
          <div key={t} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 24, color: t === 'Fiado' ? C.alerta : C.sec }}>{t}</div>
            <div
              style={{
                fontSize: d.pagamentos.fiado > 0 ? 30 : 36,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                color: t === 'Fiado' ? C.alerta : C.texto,
              }}
            >
              {reais(v)}
            </div>
          </div>
        ))}
      </div>

      {/* rodapé */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: C.sec }}>
        <span>
          {d.sobra_unidades >= 0
            ? `Sobra de ${d.sobra_unidades} unidades`
            : `${-d.sobra_unidades} unidades vendidas acima do produzido`}
        </span>
        <span style={{ color: fiado.aReceber ? C.alerta : C.sec }}>
          {d.pagamentos.fiado > 0
            ? fiado.aReceber
              ? `Fiado a receber: ${reais(fiado.aReceber)}${fiado.pago ? ` · já pago ${reais(fiado.pago)}` : ''}`
              : 'Fiado do dia todo pago'
            : `${d.vendido} de ${d.produzido} unidades vendidas`}
        </span>
      </div>
    </div>
  )
})

export default ImagemResumo

// ---------- Página "Vendas do dia": resumo no topo e a lista separada por produto ----------

const LINHAS_PRIMEIRA = 21 // a primeira página tem o cabeçalho de resumo
const LINHAS_DEMAIS = 27

const rotuloPg: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', fiado: 'Fiado' }
// Na etiqueta do fiado pago o espaço é curto
const curtoPg: Record<string, string> = { pix: 'Pix', dinheiro: 'Din.', cartao: 'Cartão' }

/** Agrupa por produto e divide em páginas de 1080×1350 (normalmente uma só). */
export function paginasDeVendas(d: DadosImagem): BlocoPagina[][] {
  if (!d.lista.length) return []
  return paginarGrupos(agruparPorProduto(d), { primeira: LINHAS_PRIMEIRA, demais: LINHAS_DEMAIS }, 1.7)
}

export const ImagemVendas = forwardRef<
  HTMLDivElement,
  { d: DadosImagem; blocos: BlocoPagina[]; pagina: number; total: number; situacao: SituacaoFiado }
>(function ImagemVendas({ d, blocos, pagina, total, situacao }, ref) {
  const grupos = agruparPorProduto(d)
  const fiado = totaisFiado(d.lista, situacao)
  const recebido = d.pagamentos.pix + d.pagamentos.dinheiro + d.pagamentos.cartao
  const unidades = grupos.reduce((s, g) => s + g.quantidade, 0)
  const td: React.CSSProperties = { padding: '0 6px', fontSize: 22, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

  return (
    <div
      ref={ref}
      style={{
        width: LARGURA,
        height: ALTURA,
        boxSizing: 'border-box',
        padding: '52px 60px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        fontFamily: 'Inter, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        color: C.texto,
        background: `radial-gradient(120% 70% at 50% 0%, #0B1638 0%, ${C.fundo} 75%)`,
        overflow: 'hidden',
      }}
    >
      {/* título */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>Vendas do dia</div>
          <div style={{ fontSize: 22, color: C.sec, marginTop: 4 }}>
            Controle de Vendas · {d.lista.length} vendas{total > 1 ? ` · parte ${pagina} de ${total}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, color: C.sec }}>{diaDaSemana(d.data)}</div>
          <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05 }}>{dataCurta(d.data)}</div>
        </div>
      </div>

      {/* cabeçalho de resumo (só na primeira página) */}
      {pagina === 1 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              { t: 'Faturamento', v: reais(d.liquido), s: `${unidades} unidades`, cor: C.texto },
              { t: 'Recebido', v: reais(recebido), s: 'Pix, dinheiro, cartão', cor: C.texto },
              {
                t: 'Fiado a receber',
                v: reais(fiado.aReceber),
                s: fiado.pago ? `já pago ${reais(fiado.pago)}` : d.pagamentos.fiado ? 'nada pago ainda' : 'sem fiado',
                cor: fiado.aReceber ? C.alerta : C.texto,
              },
              { t: 'Vendas', v: String(d.lista.length), s: `${grupos.length} ${grupos.length === 1 ? 'produto' : 'produtos'}`, cor: C.texto },
            ].map((k) => (
              <div key={k.t} style={{ ...cartao, borderRadius: 22, padding: '16px 18px', minWidth: 0 }}>
                <div style={{ ...rotulo, fontSize: 15 }}>{k.t}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: k.cor, whiteSpace: 'nowrap', marginTop: 4 }}>{k.v}</div>
                <div style={{ fontSize: 17, color: C.sec, marginTop: 2 }}>{k.s}</div>
              </div>
            ))}
          </div>
          <div style={{ ...cartao, borderRadius: 22, padding: '14px 22px', display: 'flex', flexWrap: 'wrap', gap: '8px 28px' }}>
            {grupos.map((g) => (
              <div key={g.produto} style={{ fontSize: 21 }}>
                <b>{g.produto}</b>
                <span style={{ color: C.sec }}>
                  {' '}
                  · {g.quantidade} un. · {reais(g.valor)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* listas por produto */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
        {blocos.map((b) => (
          <div key={`${b.grupo.produto}-${b.vendas[0]?.venda_id}`} style={{ ...cartao, borderRadius: 22, padding: '12px 20px 6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 6px 6px' }}>
              <div style={{ fontSize: 25, fontWeight: 800 }}>
                {b.grupo.produto}
                {b.continuacao && <span style={{ fontSize: 18, fontWeight: 500, color: C.sec }}> (continuação)</span>}
              </div>
              <div style={{ fontSize: 20, color: C.sec }}>
                {b.grupo.quantidade} un. · <b style={{ color: C.texto }}>{reais(b.grupo.valor)}</b>
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
                {b.vendas.map((v) => {
                  const s = situacao[v.venda_id]
                  const ehFiado = v.pagamento === 'fiado'
                  return (
                    <tr key={v.venda_id} style={{ height: 39, borderTop: `1px solid ${C.borda}` }}>
                      <td style={{ ...td, color: C.sec }}>{hora(v.hora)}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{v.cliente ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: C.sec }}>{v.quantidade}×</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{reais(v.valor)}</td>
                      <td style={{ ...td, paddingLeft: 18, fontSize: ehFiado ? 19 : 22, fontWeight: ehFiado ? 700 : 400, color: ehFiado ? (s ? C.positivo : C.alerta) : C.texto }}>
                        {ehFiado
                          ? s
                            ? `Fiado pago ${curtoPg[s.pagamento]} ${dataCurta(s.data).slice(0, 5)}`
                            : 'Fiado · a receber'
                          : rotuloPg[v.pagamento]}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: C.sec }}>
        <span>
          Pix {reais(d.pagamentos.pix)} · Dinheiro {reais(d.pagamentos.dinheiro)} · Cartão {reais(d.pagamentos.cartao)}
          {d.pagamentos.fiado ? ` · Fiado ${reais(d.pagamentos.fiado)}` : ''}
        </span>
        <span>{total > 1 ? `${pagina}/${total}` : ''}</span>
      </div>
    </div>
  )
})

/** Exporta o nó da imagem para PNG (1080×1350, pixelRatio 1). */
export async function gerarPng(no: HTMLElement): Promise<string> {
  await document.fonts.ready
  const opcoes = { width: LARGURA, height: ALTURA, pixelRatio: 1, cacheBust: true, backgroundColor: C.fundo }
  // A primeira chamada às vezes sai sem fonte (sobretudo no Safari); a segunda já vem completa
  await toPng(no, opcoes)
  return toPng(no, opcoes)
}

export function nomeArquivo(data: string, parte?: number) {
  return parte ? `resumo-${data}-vendas-${parte}.png` : `resumo-${data}.png`
}