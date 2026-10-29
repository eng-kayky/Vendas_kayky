import { forwardRef } from 'react'
import { toPng } from 'html-to-image'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import type { DadosImagem } from '../lib/resumo'

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
const ImagemResumo = forwardRef<HTMLDivElement, { d: DadosImagem }>(function ImagemResumo({ d }, ref) {
  const pctDesconto = d.bruto > 0 ? d.descontos / d.bruto : null
  const muitos = d.itens.length > 4
  const linhaAlt = muitos ? Math.max(44, Math.floor(300 / d.itens.length)) : 68
  const fonteLinha = muitos ? 26 : 32

  return (
    <div
      ref={ref}
      style={{
        width: LARGURA,
        height: ALTURA,
        boxSizing: 'border-box',
        padding: '72px 72px 56px',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
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
            E&amp;P
          </div>
          <div>
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>Empada &amp; Pudim</div>
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
          padding: '40px 48px',
        }}
      >
        <div style={{ ...rotulo, fontSize: 22, color: corLucro(d.lucro) }}>Lucro do dia</div>
        <div style={{ fontSize: 132, fontWeight: 800, lineHeight: 1.05, color: corLucro(d.lucro), letterSpacing: '-0.02em', marginTop: 8 }}>
          {reais(d.lucro)}
        </div>
        <div style={{ fontSize: 28, color: C.sec, marginTop: 12 }}>
          Margem de <b style={{ color: C.texto }}>{porcentagem(d.margem)}</b> sobre o faturamento líquido
        </div>
      </div>

      {/* três cartões */}
      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { t: 'Faturamento líquido', v: reais(d.liquido), s: `Bruto ${reais(d.bruto)}`, cor: C.texto },
          { t: 'Custo da produção', v: reais(d.custo), s: `${d.produzido} unidades feitas`, cor: C.texto },
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
      <div style={{ ...cartao, padding: '20px 36px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fonteLinha }}>
          <thead>
            <tr style={{ ...rotulo, height: 56 }}>
              <th style={{ textAlign: 'left', fontWeight: 600 }}>Produto</th>
              <th style={{ textAlign: 'right', fontWeight: 600, width: 90 }}>Prod.</th>
              <th style={{ textAlign: 'right', fontWeight: 600, width: 90 }}>Vend.</th>
              <th style={{ textAlign: 'right', fontWeight: 600, width: 100 }}>Sobra</th>
              <th style={{ textAlign: 'right', fontWeight: 600, width: 200 }}>Faturado</th>
              <th style={{ textAlign: 'right', fontWeight: 600, width: 190 }}>Lucro</th>
            </tr>
          </thead>
          <tbody>
            {d.itens.map((i) => (
              <tr key={i.nome} style={{ height: linhaAlt, borderTop: `1px solid ${C.borda}` }}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>{i.nome}</td>
                <td style={{ textAlign: 'right' }}>{i.produzido}</td>
                <td style={{ textAlign: 'right' }}>{i.vendido}</td>
                <td style={{ textAlign: 'right', color: i.sobra < 0 ? C.alerta : C.texto }}>{i.sobra}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{reais(i.faturado)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: corLucro(i.lucro) }}>{reais(i.lucro)}</td>
              </tr>
            ))}
            <tr style={{ height: linhaAlt, borderTop: `1px solid ${C.borda}`, fontWeight: 800 }}>
              <td>Total</td>
              <td style={{ textAlign: 'right' }}>{d.produzido}</td>
              <td style={{ textAlign: 'right' }}>{d.vendido}</td>
              <td style={{ textAlign: 'right' }}>{d.sobra_unidades}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{reais(d.liquido)}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: corLucro(d.lucro) }}>{reais(d.lucro)}</td>
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
          ] as const
        ).map(([t, v]) => (
          <div key={t} style={{ flex: 1 }}>
            <div style={{ fontSize: 24, color: C.sec }}>{t}</div>
            <div style={{ fontSize: 36, fontWeight: 800, whiteSpace: 'nowrap' }}>{reais(v)}</div>
          </div>
        ))}
      </div>

      {/* rodapé */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: C.sec }}>
        <span>
          {d.sobra_unidades >= 0
            ? `Sobra de ${d.sobra_unidades} unidades · ${reais(d.sobra_custo)} em custo`
            : `${-d.sobra_unidades} unidades vendidas acima do produzido`}
        </span>
        <span>Controle de vendas</span>
      </div>
    </div>
  )
})

export default ImagemResumo

/** Exporta o nó da imagem para PNG (1080×1350, pixelRatio 1). */
export async function gerarPng(no: HTMLElement): Promise<string> {
  await document.fonts.ready
  const opcoes = { width: LARGURA, height: ALTURA, pixelRatio: 1, cacheBust: true, backgroundColor: C.fundo }
  // A primeira chamada às vezes sai sem fonte (sobretudo no Safari); a segunda já vem completa
  await toPng(no, opcoes)
  return toPng(no, opcoes)
}

export function nomeArquivo(data: string) {
  return `resumo-${data}.png`
}
