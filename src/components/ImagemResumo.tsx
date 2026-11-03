import { forwardRef } from 'react'
import { toPng } from 'html-to-image'
import { dataCurta, diaDaSemana, hora } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { totaisFiado, type DadosImagem, type SituacaoFiado } from '../lib/resumo'

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

// ---------- Páginas com a lista de todas as vendas do dia ----------

export const VENDAS_POR_PAGINA = 18

const rotuloPg: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', fiado: 'Fiado' }

/** Divide a lista em páginas de 1080×1350. */
export function paginasDeVendas(d: DadosImagem) {
  const paginas: DadosImagem['lista'][] = []
  for (let i = 0; i < d.lista.length; i += VENDAS_POR_PAGINA) paginas.push(d.lista.slice(i, i + VENDAS_POR_PAGINA))
  return paginas
}

export const ImagemVendas = forwardRef<
  HTMLDivElement,
  { d: DadosImagem; vendas: DadosImagem['lista']; pagina: number; total: number; situacao: SituacaoFiado }
>(function ImagemVendas({ d, vendas, pagina, total, situacao }, ref) {
  const th: React.CSSProperties = { ...rotulo, fontSize: 18, fontWeight: 600, textAlign: 'left', padding: '0 8px 14px' }
  const td: React.CSSProperties = { padding: '0 6px', fontSize: 23, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  return (
    <div
      ref={ref}
      style={{
        width: LARGURA,
        height: ALTURA,
        boxSizing: 'border-box',
        padding: '60px 64px 48px',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>Vendas do dia</div>
          <div style={{ fontSize: 24, color: C.sec, marginTop: 4 }}>
            Controle de Vendas · {total > 1 ? `parte ${pagina} de ${total}` : `${d.lista.length} vendas`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, color: C.sec }}>{diaDaSemana(d.data)}</div>
          <div style={{ fontSize: 48, fontWeight: 800 }}>{dataCurta(d.data)}</div>
        </div>
      </div>

      <div style={{ ...cartao, padding: '28px 28px', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 82 }} />
            <col style={{ width: 186 }} />
            <col />
            <col style={{ width: 56 }} />
            <col style={{ width: 132 }} />
            <col style={{ width: 196 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th}>Hora</th>
              <th style={th}>Cliente</th>
              <th style={th}>Produto</th>
              <th style={{ ...th, textAlign: 'right' }}>Qtd</th>
              <th style={{ ...th, textAlign: 'right' }}>Valor</th>
              <th style={th}>Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map((v) => {
              const s = situacao[v.venda_id]
              const fiado = v.pagamento === 'fiado'
              return (
                <tr key={v.venda_id} style={{ height: 58, borderTop: `1px solid ${C.borda}` }}>
                  <td style={{ ...td, color: C.sec }}>{hora(v.hora)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{v.cliente ?? '—'}</td>
                  <td style={td}>{v.produto}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{v.quantidade}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{reais(v.valor)}</td>
                  <td style={td}>
                    {fiado ? (
                      <div style={{ lineHeight: 1.15, color: s ? C.positivo : C.alerta, fontWeight: 700 }}>
                        <div style={{ fontSize: 21 }}>Fiado</div>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>
                          {s ? `pago ${rotuloPg[s.pagamento]} ${dataCurta(s.data).slice(0, 5)}` : 'a receber'}
                        </div>
                      </div>
                    ) : (
                      rotuloPg[v.pagamento]
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: C.sec }}>
        <span>Faturamento do dia {reais(d.liquido)}</span>
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
