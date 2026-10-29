// Só em desenvolvimento (npm run dev): #/dev/imagem mostra a imagem com os dados do caso de aceite.
import { useEffect, useRef, useState } from 'react'
import ImagemResumo, { gerarPng } from '../components/ImagemResumo'
import { calcularResumo, criarSnapshot, imagemDoSnapshot } from '../lib/resumo'

const itens = [
  { id: 'f', nome: 'Empada de frango', produzido: 40, preco: 600, custo: 250 },
  { id: 'p', nome: 'Empada de palmito', produzido: 30, preco: 600, custo: 250 },
  { id: 'u', nome: 'Pudim', produzido: 20, preco: 800, custo: 350 },
]
const vendas = [
  { item_dia_id: 'f', quantidade: 20, valor_cobrado: 12000, pagamento: 'pix' as const },
  { item_dia_id: 'f', quantidade: 8, valor_cobrado: 4400, pagamento: 'dinheiro' as const },
  { item_dia_id: 'p', quantidade: 15, valor_cobrado: 9000, pagamento: 'pix' as const },
  { item_dia_id: 'p', quantidade: 4, valor_cobrado: 2400, pagamento: 'cartao' as const },
  { item_dia_id: 'p', quantidade: 5, valor_cobrado: 2400, pagamento: 'dinheiro' as const },
  { item_dia_id: 'u', quantidade: 2, valor_cobrado: 1600, pagamento: 'cartao' as const },
  { item_dia_id: 'u', quantidade: 7, valor_cobrado: 5200, pagamento: 'dinheiro' as const },
]

export default function DevImagem() {
  const ref = useRef<HTMLDivElement>(null)
  const [png, setPng] = useState<string | null>(null)
  const dados = imagemDoSnapshot(criarSnapshot('2026-10-29', calcularResumo(itens, vendas), new Date().toISOString()))

  useEffect(() => {
    if (ref.current) gerarPng(ref.current).then(setPng)
  }, [])

  return (
    <div className="p-4">
      {png ? <img id="png" src={png} alt="prévia" className="w-full max-w-[540px]" /> : <p>Gerando…</p>}
      <div style={{ position: 'fixed', left: -20000, top: 0 }}>
        <ImagemResumo ref={ref} d={dados} />
      </div>
    </div>
  )
}
