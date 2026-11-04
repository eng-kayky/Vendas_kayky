// Só em desenvolvimento (npm run dev):
//   #/dev/imagem          → as 3 imagens com dados de exemplo
//   #/dev/imagem?painel   → painel do dia aberto
//   #/dev/imagem?fechado  → painel do dia fechado
import { useEffect, useRef, useState } from 'react'
import { agregarRelatorio, periodoDe, resumirDia } from '../lib/calculos'
import type { DiaCompleto, Pagamento, Pedido } from '../lib/tipos'
import { gerarPng, ImagemRelatorio, ImagemResumo, ImagemVendas, paginasDeVendas } from '../components/Imagens'
import PainelDia from '../components/PainelDia'
import { Navegacao } from '../components/ui'
import Venda from './Venda'

const itens = [
  { id: 'f', produtoId: 'pf', nome: 'Empada de frango', unidade: 'un', produzido: 30, preco: 600 },
  { id: 'c', produtoId: 'pc', nome: 'Empada de camarão', unidade: 'un', produzido: 15, preco: 800 },
  { id: 'u', produtoId: 'pu', nome: 'Pudim', unidade: 'fatia', produzido: 12, preco: 500 },
  { id: 'b', produtoId: 'pb', nome: 'Bolo de pote', unidade: 'pote', produzido: null, preco: 1000 },
  { id: 't', produtoId: 'pt', nome: 'Torta de limão', unidade: 'fatia', produzido: 8, preco: 700 },
  { id: 'r', produtoId: 'pr', nome: 'Refrigerante lata', unidade: 'lata', produzido: null, preco: 500 },
]
const nomes = ['Yago', 'João Victor', 'Rodolfo', 'Kayky', 'Jandison', 'Priscilla', 'Moisés', 'Jorge', 'Prof Tauany', 'Prof Mayara', 'Lucas Felipe', 'Ana Paula', null]
const formas: Pagamento[] = ['pix', 'pix', 'dinheiro', 'pix', 'cartao', 'fiado', 'pix', 'dinheiro']
const carrinhos: [string, number][][] = [[['f', 2]], [['f', 1], ['r', 1]], [['u', 1]], [['c', 2], ['r', 2]], [['b', 1]], [['f', 3]], [['t', 1], ['u', 1]], [['f', 1]]]

const pedidos: Pedido[] = Array.from({ length: 22 }, (_, i) => {
  const linhas = carrinhos[i % carrinhos.length].map(([item, q], k) => {
    const preco = itens.find((x) => x.id === item)!.preco
    return { id: `pi${i}-${k}`, itemDiaId: item, quantidade: q, precoUnit: preco, subtotal: q * preco }
  })
  const sub = linhas.reduce((s, l) => s + l.subtotal, 0)
  const pagamento = formas[i % formas.length]
  const cliente = pagamento === 'pix' || pagamento === 'fiado' ? (nomes[i % (nomes.length - 1)] as string) : nomes[i % nomes.length]
  const desconto = i % 6 === 2 ? 100 : 0
  const pago = pagamento === 'fiado' && i % 2 === 1
  return {
    id: `p${i}`,
    diaId: 'd',
    clienteId: cliente ? `c${i}` : null,
    cliente,
    status: 'concluido',
    pagamento,
    desconto,
    total: sub - desconto,
    observacao: null,
    fiadoPagoEm: pago ? '2026-11-05' : null,
    fiadoPagoCom: pago ? 'pix' : null,
    criadoEm: `2026-11-04T${String(13 + Math.floor(i / 3)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00Z`,
    itens: linhas,
  }
})
pedidos.push({ ...pedidos[0], id: 'res', status: 'reservado', pagamento: null, cliente: 'Carla', total: 1200, desconto: 0, criadoEm: '2026-11-04T21:00:00Z' })

const fechado = window.location.hash.includes('fechado')
const d: DiaCompleto = {
  dia: { id: 'd', data: '2026-11-04', status: fechado ? 'fechado' : 'aberto', gasto: 6500, semGasto: false, fechadoEm: null },
  itens,
  pedidos: fechado ? pedidos.filter((p) => p.status === 'concluido') : pedidos,
}

export default function DevImagem() {
  if (window.location.hash.includes('venda')) return <Venda exemplo={{ d, produto: 'f' }} />
  if (window.location.hash.includes('painel') || fechado)
    return (
      <>
        <Navegacao />
        <PainelDia d={d} onMudou={() => {}} />
      </>
    )
  return <Imagens />
}

function Imagens() {
  const nos = useRef<(HTMLDivElement | null)[]>([])
  const [pngs, setPngs] = useState<string[]>([])
  const r = resumirDia(d)
  const paginas = paginasDeVendas(d)
  const outroDia = { ...d, dia: { ...d.dia, id: 'd2', data: '2026-11-03', gasto: null, semGasto: true }, pedidos: pedidos.slice(0, 10) }

  useEffect(() => {
    ;(async () => {
      const urls: string[] = []
      for (const no of nos.current) if (no) urls.push(await gerarPng(no))
      setPngs(urls)
    })()
  }, [])

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {pngs.length ? pngs.map((u, i) => <img key={i} id={`png${i}`} src={u} alt="prévia" className="w-[360px]" />) : <p>Gerando…</p>}
      <div style={{ position: 'fixed', left: -20000, top: 0 }}>
        <ImagemResumo ref={(el) => (nos.current[0] = el)} d={d} r={r} />
        {paginas.map((b, i) => (
          <ImagemVendas key={i} ref={(el) => (nos.current[i + 1] = el)} d={d} r={r} blocos={b} pagina={i + 1} total={paginas.length} />
        ))}
        <ImagemRelatorio ref={(el) => (nos.current[1 + paginas.length] = el)} r={agregarRelatorio([d, outroDia])} periodo={periodoDe('semana', '2026-11-04')} />
      </div>
    </div>
  )
}
