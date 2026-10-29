import { useState } from 'react'
import { desfazerVenda, mensagemErro, type ItemDia, type Venda } from '../lib/api'
import { hora } from '../lib/datas'
import { reais } from '../lib/dinheiro'
import { descontoVenda, PAGAMENTOS } from '../lib/resumo'
import { useOnline } from '../hooks'
import { Aviso, Confirmar, Icone } from './ui'

const rotuloPg = Object.fromEntries(PAGAMENTOS.map((p) => [p.valor, p.rotulo]))

function Desconto({ valor }: { valor: number }) {
  if (valor === 0) return <span className="text-sec">—</span>
  if (valor > 0) return <span className="text-alerta">{reais(-valor)}</span>
  return <span className="text-positivo">+{reais(-valor)} acrésc.</span>
}

/** Lista de vendas do dia com "desfazer". `modo` tabela (desktop) ou cartões (celular). */
export default function VendasLista({
  vendas,
  itens,
  aberto,
  modo,
  onMudou,
}: {
  vendas: Venda[]
  itens: ItemDia[]
  aberto: boolean
  modo: 'tabela' | 'cartoes'
  onMudou: () => void
}) {
  const online = useOnline()
  const [alvo, setAlvo] = useState<Venda | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const porId = new Map(itens.map((i) => [i.id, i]))

  async function confirmar() {
    if (!alvo) return
    setOcupado(true)
    setErro(null)
    try {
      await desfazerVenda(alvo.id)
      setAlvo(null)
      onMudou()
    } catch (e) {
      setErro(mensagemErro(e))
      setAlvo(null)
    } finally {
      setOcupado(false)
    }
  }

  const linhas = vendas.map((v) => {
    const item = porId.get(v.item_dia_id)
    return { v, nome: item?.nome ?? '—', desconto: item ? descontoVenda(v.quantidade, item.preco, v.valor_cobrado) : 0 }
  })

  const botaoDesfazer = (v: Venda) =>
    aberto && (
      <button
        type="button"
        onClick={() => setAlvo(v)}
        disabled={!online}
        className="grid size-11 place-items-center rounded-xl text-sec hover:bg-alerta/10 hover:text-alerta disabled:opacity-40"
        aria-label="Desfazer venda"
        title="Desfazer venda"
      >
        <Icone nome="desfazer" />
      </button>
    )

  return (
    <>
      {erro && (
        <div className="mb-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      {vendas.length === 0 ? (
        <p className="py-6 text-center text-sec">Nenhuma venda registrada ainda.</p>
      ) : modo === 'tabela' ? (
        <div className="overflow-x-auto">
          <table className="num w-full text-left">
            <thead>
              <tr className="rotulo border-b border-borda">
                <th className="px-3 py-3 font-semibold">Hora</th>
                <th className="px-3 py-3 font-semibold">Cliente</th>
                <th className="px-3 py-3 font-semibold">Produto</th>
                <th className="px-3 py-3 text-right font-semibold">Qtd</th>
                <th className="px-3 py-3 text-right font-semibold">Cobrado</th>
                <th className="px-3 py-3 text-right font-semibold">Desconto</th>
                <th className="px-3 py-3 font-semibold">Pgto</th>
                {aberto && <th className="w-14 px-1 py-3"><span className="sr-only">Desfazer</span></th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ v, nome, desconto }) => (
                <tr key={v.id} className="border-b border-borda/60 last:border-0">
                  <td className="px-3 py-2 text-sec">{hora(v.criado_em)}</td>
                  <td className="px-3 py-2">{v.cliente || <span className="text-sec">—</span>}</td>
                  <td className="px-3 py-2">{nome}</td>
                  <td className="px-3 py-2 text-right">{v.quantidade}</td>
                  <td className="px-3 py-2 text-right font-bold">{reais(v.valor_cobrado)}</td>
                  <td className="px-3 py-2 text-right">
                    <Desconto valor={desconto} />
                  </td>
                  <td className="px-3 py-2">{rotuloPg[v.pagamento]}</td>
                  {aberto && <td className="px-1 py-1">{botaoDesfazer(v)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-2">
          {linhas.map(({ v, nome, desconto }) => (
            <li key={v.id} className="cartao num flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">
                    {v.quantidade}× {nome}
                  </span>
                  <span className="shrink-0 font-bold">{reais(v.valor_cobrado)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-sm text-sec">
                  <span className="truncate">
                    {hora(v.criado_em)} · {rotuloPg[v.pagamento]} · {v.cliente || 'sem nome'}
                  </span>
                  <span className="shrink-0">
                    <Desconto valor={desconto} />
                  </span>
                </div>
              </div>
              {botaoDesfazer(v)}
            </li>
          ))}
        </ul>
      )}

      <Confirmar
        aberto={alvo !== null}
        titulo="Desfazer esta venda?"
        confirmar="Desfazer venda"
        perigo
        ocupado={ocupado}
        onConfirmar={confirmar}
        onCancelar={() => setAlvo(null)}
      >
        {alvo && (
          <>
            {alvo.quantidade}× {porId.get(alvo.item_dia_id)?.nome} por {reais(alvo.valor_cobrado)}
            {alvo.cliente ? ` (${alvo.cliente})` : ''}, às {hora(alvo.criado_em)}. As unidades voltam para o estoque.
          </>
        )}
      </Confirmar>
    </>
  )
}
