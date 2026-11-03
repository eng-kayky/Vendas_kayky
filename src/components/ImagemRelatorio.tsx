import { forwardRef } from 'react'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { porcentagem, reais } from '../lib/dinheiro'
import { nomePeriodo, type Periodo, type Relatorio } from '../lib/relatorio'
import { ALTURA, LARGURA } from './ImagemResumo'

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
const rotulo: React.CSSProperties = { fontSize: 19, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.sec }
const cartao: React.CSSProperties = { background: C.cartao, border: `1px solid ${C.borda}`, borderRadius: 26 }

/** Imagem do relatório da semana ou do mês (1080×1350). */
const ImagemRelatorio = forwardRef<HTMLDivElement, { r: Relatorio; periodo: Periodo }>(function ImagemRelatorio({ r, periodo }, ref) {
  const corLucro = r.lucro < 0 ? C.alerta : C.positivo
  const produtos = r.produtos.slice(0, 6)
  const clientes = r.clientes.slice(0, 5)
  const maxDia = Math.max(1, ...r.porDia.map((d) => d.faturamento))
  const dias = r.porDia.slice(-10) // no mês, mostra os 10 últimos dias trabalhados

  return (
    <div
      ref={ref}
      style={{
        width: LARGURA,
        height: ALTURA,
        boxSizing: 'border-box',
        padding: '56px 64px 44px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        fontFamily: 'Inter, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        color: C.texto,
        background: `radial-gradient(120% 70% at 50% 0%, #0B1638 0%, ${C.fundo} 75%)`,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              width: 76,
              height: 76,
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
            <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.1 }}>Controle de Vendas</div>
            <div style={{ fontSize: 24, color: C.sec, marginTop: 4 }}>Relatório {periodo.tipo === 'semana' ? 'da semana' : 'do mês'}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 40, fontWeight: 800 }}>{nomePeriodo(periodo)}</div>
      </div>

      <div
        style={{
          ...cartao,
          padding: '28px 44px',
          borderColor: r.lucro < 0 ? 'rgba(255,154,168,0.35)' : 'rgba(61,220,151,0.3)',
          background: `linear-gradient(135deg, ${r.lucro < 0 ? '#2A1020' : '#0D2A2E'} 0%, ${C.cartao} 70%)`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <div style={{ ...rotulo, color: corLucro }}>Lucro do período</div>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.05, color: corLucro, letterSpacing: '-0.02em' }}>{reais(r.lucro)}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 24, color: C.sec, lineHeight: 1.5 }}>
          <div>
            Margem <b style={{ color: C.texto }}>{porcentagem(r.margem)}</b>
          </div>
          <div>
            {r.dias} {r.dias === 1 ? 'dia trabalhado' : 'dias trabalhados'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { t: 'Faturamento', v: reais(r.faturamento), s: `${r.unidades} unidades`, cor: C.texto },
          { t: 'Recebido', v: reais(r.recebido), s: 'Pix, dinheiro, cartão', cor: C.texto },
          { t: 'Fiado a receber', v: reais(r.fiadoAReceber), s: `de ${reais(r.pagamentos.fiado)}`, cor: r.fiadoAReceber ? C.alerta : C.texto },
          { t: 'Gasto', v: reais(r.gasto), s: r.diasSemGasto ? `${r.diasSemGasto} dia(s) N/A` : 'com material', cor: C.texto },
        ].map((k) => (
          <div key={k.t} style={{ ...cartao, padding: '20px 22px', minWidth: 0 }}>
            <div style={{ ...rotulo, fontSize: 16, minHeight: 40 }}>{k.t}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: k.cor, whiteSpace: 'nowrap', marginTop: 6 }}>{k.v}</div>
            <div style={{ fontSize: 19, color: C.sec, marginTop: 6 }}>{k.s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* produtos */}
        <div style={{ ...cartao, flex: 1.25, padding: '22px 26px', minWidth: 0 }}>
          <div style={{ ...rotulo, marginBottom: 10 }}>Por produto</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 24 }}>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.nome} style={{ height: 52, borderTop: `1px solid ${C.borda}` }}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{p.nome}</td>
                  <td style={{ textAlign: 'right', color: C.sec, paddingLeft: 10 }}>{p.vendido} un.</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, paddingLeft: 12, whiteSpace: 'nowrap' }}>{reais(p.faturado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...rotulo, margin: '24px 0 10px' }}>Clientes que mais compraram</div>
          {clientes.length ? (
            clientes.map((cl, i) => (
              <div key={cl.nome} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, padding: '6px 0' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: C.sec }}>{i + 1}.</span> {cl.nome}
                </span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap', paddingLeft: 10 }}>{reais(cl.total)}</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 22, color: C.sec }}>Sem nomes registrados.</div>
          )}
        </div>

        {/* dias */}
        <div style={{ ...cartao, flex: 1, padding: '22px 26px', minWidth: 0 }}>
          <div style={{ ...rotulo, marginBottom: 14 }}>Por dia</div>
          {dias.map((d) => (
            <div key={d.data} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 21 }}>
                <span>
                  {dataCurta(d.data).slice(0, 5)} <span style={{ color: C.sec }}>{diaDaSemana(d.data).split('-')[0]}</span>
                </span>
                <span style={{ fontWeight: 700 }}>{reais(d.faturamento)}</span>
              </div>
              <div style={{ height: 10, background: C.borda, borderRadius: 6, marginTop: 6 }}>
                <div style={{ height: 10, width: `${(d.faturamento / maxDia) * 100}%`, background: C.destaque, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...cartao, padding: '18px 32px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ ...rotulo, width: 120, fontSize: 17 }}>Recebido por</div>
        {(
          [
            ['Pix', r.pagamentos.pix],
            ['Dinheiro', r.pagamentos.dinheiro],
            ['Cartão', r.pagamentos.cartao],
            ['Fiado', r.pagamentos.fiado],
          ] as const
        ).map(([t, v]) => (
          <div key={t} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, color: t === 'Fiado' ? C.alerta : C.sec }}>{t}</div>
            <div style={{ fontSize: 27, fontWeight: 800, whiteSpace: 'nowrap', color: t === 'Fiado' ? C.alerta : C.texto }}>{reais(v)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: C.sec }}>
        <span>{r.melhorDia ? `Melhor dia: ${dataCurta(r.melhorDia.data)} · ${reais(r.melhorDia.faturamento)}` : ''}</span>
        <span>{r.ticketMedio ? `Ticket médio ${reais(r.ticketMedio)}` : `${r.vendas} vendas`}</span>
      </div>
    </div>
  )
})

export default ImagemRelatorio
