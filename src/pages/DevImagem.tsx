// Só em desenvolvimento (npm run dev): #/dev/imagem mostra as imagens com dados de exemplo.
import { useEffect, useRef, useState } from 'react'
import ImagemResumo, { gerarPng, ImagemVendas, paginasDeVendas } from '../components/ImagemResumo'
import { calcularResumo, criarSnapshot, imagemDoSnapshot, listarVendasDoDia, type Pagamento } from '../lib/resumo'
import { agregarRelatorio, periodoDe } from '../lib/relatorio'
import ImagemRelatorio from '../components/ImagemRelatorio'

const itens = [
  { id: 'f', nome: 'Empada de frango', produzido: 40, preco: 600 },
  { id: 'p', nome: 'Empada de palmito', produzido: 30, preco: 600 },
  { id: 'u', nome: 'Pudim', produzido: 20, preco: 800 },
]
const base: [string, number, number, Pagamento, string | null][] = [
  ['f', 20, 12000, 'pix', 'Ana Paula R.'],
  ['f', 8, 4400, 'dinheiro', null],
  ['p', 15, 9000, 'pix', 'Carlos M.'],
  ['p', 4, 2400, 'cartao', 'Fernanda L.'],
  ['p', 5, 2400, 'dinheiro', null],
  ['u', 2, 1600, 'cartao', 'Yago'],
  ['u', 7, 5200, 'dinheiro', 'João Victor'],
  ['f', 3, 1800, 'fiado', 'Maria das Graças'],
  ['u', 1, 800, 'fiado', 'Pedro'],
]
const vendas = base.map(([item, q, v, p, cli], i) => ({
  id: `v${i}`,
  item_dia_id: item,
  quantidade: q,
  valor_cobrado: v,
  pagamento: p,
  cliente: cli,
  criado_em: `2026-10-29T${String(13 + Math.floor(i / 3)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00Z`,
}))
const situacao = { v7: { pagamento: 'pix' as const, data: '2026-11-02' } }

export default function DevImagem() {
  const nos = useRef<(HTMLDivElement | null)[]>([])
  const [pngs, setPngs] = useState<string[]>([])
  const r = calcularResumo(itens, vendas)
  const snap = criarSnapshot('2026-10-29', r, 24500, new Date().toISOString(), listarVendasDoDia(itens, vendas))
  const dados = imagemDoSnapshot(snap)
  const paginas = paginasDeVendas(dados)

  useEffect(() => {
    ;(async () => {
      const urls: string[] = []
      for (const no of nos.current) if (no) urls.push(await gerarPng(no))
      setPngs(urls)
    })()
  }, [])

  return (
    <div className="flex flex-wrap gap-4 p-4">
      {pngs.length ? pngs.map((u, i) => <img key={i} id={`png${i}`} src={u} alt="prévia" className="w-[400px]" />) : <p>Gerando…</p>}
      <div style={{ position: 'fixed', left: -20000, top: 0 }}>
        <ImagemResumo ref={(el) => (nos.current[0] = el)} d={dados} situacao={situacao} />
        {paginas.map((vs, i) => (
          <ImagemVendas
            key={i}
            ref={(el) => (nos.current[i + 1] = el)}
            d={dados}
            vendas={vs}
            pagina={i + 1}
            total={paginas.length}
            situacao={situacao}
          />
        ))}
        <ImagemRelatorio
          ref={(el) => (nos.current[1 + paginas.length] = el)}
          r={agregarRelatorio([snap, { ...snap, data: '2026-10-27' }, { ...snap, data: '2026-10-28', totais: { ...snap.totais, liquido: 250, lucro: 90 } }], situacao)}
          periodo={periodoDe('semana', '2026-10-29')}
        />
      </div>
    </div>
  )
}
