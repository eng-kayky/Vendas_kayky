import { useState } from 'react'
import { criarProduto, listarProdutos, mensagemErro, salvarProduto, type Produto } from '../lib/api'
import { lerReais, numeroBR, reais } from '../lib/dinheiro'
import { useCarregar, useOnline } from '../hooks'
import { Abas, Aviso, Carregando, Pagina, Topo } from '../components/ui'

export default function Produtos() {
  const online = useOnline()
  const { dados, erro: erroCarga, carregando, recarregar } = useCarregar(listarProdutos)
  const [editando, setEditando] = useState<{ id: string; nome: string; preco: string } | null>(null)
  const [novo, setNovo] = useState<{ nome: string; preco: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function executar(acao: () => Promise<unknown>) {
    setErro(null)
    setOcupado(true)
    try {
      await acao()
      await recarregar()
      return true
    } catch (e) {
      setErro(mensagemErro(e))
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function salvarEdicao() {
    if (!editando) return
    const preco = lerReais(editando.preco)
    if (!editando.nome.trim() || preco === null) return setErro('Preencha o nome e um preço válido.')
    if (await executar(() => salvarProduto(editando.id, { nome: editando.nome, preco }))) setEditando(null)
  }

  async function salvarNovo() {
    if (!novo) return
    const preco = lerReais(novo.preco)
    if (!novo.nome.trim() || preco === null) return setErro('Preencha o nome e um preço válido.')
    if (await executar(() => criarProduto(novo.nome, preco))) setNovo(null)
  }

  const ativos = dados?.filter((p) => p.ativo) ?? []
  const removidos = dados?.filter((p) => !p.ativo) ?? []

  const linha = (p: Produto) =>
    editando?.id === p.id ? (
      <li key={p.id} className="cartao space-y-3 border-destaque p-4">
        <div className="space-y-1.5">
          <label htmlFor="ed-nome" className="rotulo block">
            Nome
          </label>
          <input id="ed-nome" className="campo" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ed-preco" className="rotulo block">
            Preço (R$)
          </label>
          <input
            id="ed-preco"
            className="campo num"
            inputMode="decimal"
            value={editando.preco}
            onChange={(e) => setEditando({ ...editando, preco: e.target.value })}
          />
        </div>
        <p className="text-xs text-sec">O preço novo vale a partir do próximo dia aberto. Dias anteriores não mudam.</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secundario flex-1" onClick={() => setEditando(null)} disabled={ocupado}>
            Cancelar
          </button>
          <button type="button" className="btn-primario flex-1" onClick={salvarEdicao} disabled={ocupado || !online}>
            Salvar
          </button>
        </div>
      </li>
    ) : (
      <li key={p.id} className={`cartao num flex items-center justify-between gap-3 px-4 py-3 ${p.ativo ? '' : 'opacity-60'}`}>
        <div className="min-w-0">
          <p className="truncate font-bold">{p.nome}</p>
          <p className="text-sm text-sec">{reais(p.preco)}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {p.ativo ? (
            <>
              <button
                type="button"
                className="btn min-h-11 px-3 text-claro hover:bg-destaque/10"
                onClick={() => setEditando({ id: p.id, nome: p.nome, preco: numeroBR(p.preco) })}
                disabled={!online}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn min-h-11 px-3 text-sec hover:bg-alerta/10 hover:text-alerta"
                onClick={() => executar(() => salvarProduto(p.id, { ativo: false }))}
                disabled={ocupado || !online}
              >
                Remover
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn min-h-11 px-3 text-positivo hover:bg-positivo/10"
              onClick={() => executar(() => salvarProduto(p.id, { ativo: true }))}
              disabled={ocupado || !online}
            >
              Reativar
            </button>
          )}
        </div>
      </li>
    )

  return (
    <Pagina largura="max-w-3xl">
      <div className="md:hidden">
        <Topo titulo="Produtos" />
      </div>
      <div className="hidden pb-5 pt-6 md:block">
        <h1 className="mb-4 text-3xl font-extrabold">Produtos</h1>
        <Abas />
      </div>

      {(erro || erroCarga) && (
        <div className="mb-3">
          <Aviso>{erro ?? erroCarga}</Aviso>
        </div>
      )}

      {carregando && !dados ? (
        <Carregando />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-sec">
            Os produtos ativos aparecem ao abrir o dia. Remover não apaga o histórico; dá para reativar depois.
          </p>
          <ul className="space-y-2">{ativos.map(linha)}</ul>

          {novo ? (
            <div className="cartao space-y-3 border-dashed p-4">
              <div className="space-y-1.5">
                <label htmlFor="nv-nome" className="rotulo block">
                  Nome do produto
                </label>
                <input id="nv-nome" className="campo" autoFocus value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="nv-preco" className="rotulo block">
                  Preço (R$)
                </label>
                <input
                  id="nv-preco"
                  className="campo num"
                  inputMode="decimal"
                  value={novo.preco}
                  onChange={(e) => setNovo({ ...novo, preco: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secundario flex-1" onClick={() => setNovo(null)}>
                  Cancelar
                </button>
                <button type="button" className="btn-primario flex-1" onClick={salvarNovo} disabled={ocupado || !online}>
                  Adicionar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn min-h-14 w-full rounded-2xl border border-dashed border-borda text-claro hover:border-destaque"
              onClick={() => setNovo({ nome: '', preco: '' })}
            >
              + Novo produto
            </button>
          )}

          {removidos.length > 0 && (
            <>
              <h2 className="rotulo pt-2">Removidos</h2>
              <ul className="space-y-2">{removidos.map(linha)}</ul>
            </>
          )}
        </div>
      )}
    </Pagina>
  )
}
