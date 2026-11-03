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
// Parecido com um dia real: 17 vendas de empada e pudim
const base: [string, number, number, Pagamento, string | null][] = [
  ['f', 1, 600, 'pix', 'Yago'],
  ['f', 1, 600, 'pix', 'João Victor'],
  ['u', 1, 500, 'fiado', 'João Victor'],
  ['u', 2, 1000, 'pix', 'Rodolfo'],
  ['f', 1, 600, 'pix', 'Kayky'],
  ['f', 1, 600, 'pix', 'Jandison'],
  ['f', 1, 600, 'pix', 'Priscilla'],
  ['u', 1, 500, 'pix', 'Moisés'],
  ['u', 1, 500, 'fiado', 'Jandison'],
  ['f', 1, 600, 'pix', 'Jorge'],
  ['f', 1, 600, 'pix', 'Prof Tauany'],
  ['f', 1, 600, 'fiado', 'Prof Mayara'],
  ['f', 1, 600, 'pix', 'Lucas Felipe'],
  ['f', 1, 600, 'pix', 'Lucas Ian'],
  ['f', 1, 600, 'dinheiro', 'Eduardo'],
  ['u', 1, 400, 'pix', 'Lucas Felipe'],
  ['u', 1, 500, 'pix', 'Jorge'],
]
// #/dev/imagem?cheio → dia cheio: 6 produtos e 32 vendas
const cheio = window.location.hash.includes('cheio')
const itensCheio = [
  { id: 'f', nome: 'Empada de frango', produzido: 30, preco: 600 },
  { id: 'p', nome: 'Empada de palmito', produzido: 20, preco: 600 },
  { id: 'c', nome: 'Empada de camarão', produzido: 15, preco: 800 },
  { id: 'u', nome: 'Pudim', produzido: 12, preco: 500 },
  { id: 'b', nome: 'Bolo de pote', produzido: 10, preco: 1000 },
  { id: 't', nome: 'Torta de limão', produzido: 8, preco: 700 },
]
const nomes = ['Yago', 'João Victor', 'Rodolfo', 'Kayky', 'Jandison', 'Priscilla', 'Moisés', 'Jorge', 'Prof Tauany', 'Prof Mayara', 'Lucas Felipe', 'Lucas Ian', 'Eduardo', 'Ana Paula', 'Carlos Eduardo', 'Fernanda Lima']
const formas: Pagamento[] = ['pix', 'pix', 'dinheiro', 'pix', 'cartao', 'pix', 'fiado', 'pix']
const baseCheio: [string, number, number, Pagamento, string | null][] = Array.from({ length: 32 }, (_, i) => {
  const item = itensCheio[[0, 0, 1, 2, 0, 3, 1, 4, 0, 5, 2, 3][i % 12]]
  const q = i % 7 === 0 ? 2 : 1
  return [item.id, q, q * item.preco, formas[i % formas.length], i % 9 === 4 ? null : nomes[i % nomes.length]]
})

const vendas = (cheio ? baseCheio : base).map(([item, q, v, p, cli], i) => ({
  id: `v${i}`,
  item_dia_id: item,
  quantidade: q,
  valor_cobrado: v,
  pagamento: p,
  cliente: cli,
  criado_em: `2026-10-29T${String(13 + Math.floor(i / 3)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00Z`,
}))
const itensUsados = cheio ? itensCheio : itens
const situacao = {
  v8: { pagamento: 'pix' as const, data: '2026-10-30' },
  v11: { pagamento: 'pix' as const, data: '2026-10-30' },
  v14: { pagamento: 'dinheiro' as const, data: '2026-10-31' },
}

export default function DevImagem() {
  const nos = useRef<(HTMLDivElement | null)[]>([])
  const [pngs, setPngs] = useState<string[]>([])
  const r = calcularResumo(itensUsados, vendas)
  const snap = criarSnapshot('2026-10-29', r, 24500, new Date().toISOString(), listarVendasDoDia(itensUsados, vendas))
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
            blocos={vs}
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
