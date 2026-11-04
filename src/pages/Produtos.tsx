import { useState } from 'react'
import { criarProduto, listarProdutos, mensagemErro, salvarProduto } from '../lib/api'
import { lerReais, numeroBR, reais } from '../lib/dinheiro'
import { UNIDADES, type Produto } from '../lib/tipos'
import { useCarregar, useOnline } from '../hooks'
import { Aviso, Campo, Carregando, Icone, Pagina, Selo, TituloSecao, Vazio } from '../components/ui'

interface Form {
  id?: string
  nome: string
  preco: string
  unidade: string
  categoria: string
}

const vazio: Form = { nome: '', preco: '', unidade: 'un', categoria: '' }

/** Cadastro de produtos: nome, preço padrão, unidade e categoria. */
export default function Produtos() {
  const online = useOnline()
  const { dados, erro: erroCarga, carregando, recarregar } = useCarregar(listarProdutos)
  const [form, setForm] = useState<Form | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [verInativos, setVerInativos] = useState(false)

  const categorias = [...new Set((dados ?? []).map((p) => p.categoria).filter(Boolean) as string[])].sort()
  const ativos = (dados ?? []).filter((p) => p.ativo)
  const inativos = (dados ?? []).filter((p) => !p.ativo)
  const grupos = new Map<string, Produto[]>()
  for (const p of ativos) grupos.set(p.categoria ?? '', [...(grupos.get(p.categoria ?? '') ?? []), p])

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true)
    setErro(null)
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

  async function salvar() {
    if (!form) return
    const preco = lerReais(form.preco)
    if (!form.nome.trim() || preco === null) return setErro('Preencha o nome e um preço válido.')
    const campos = { nome: form.nome, preco, unidade: form.unidade, categoria: form.categoria || null }
    const ok = await executar(() => (form.id ? salvarProduto(form.id, campos) : criarProduto(campos)))
    if (ok) setForm(null)
  }

  const editor = (
    <section className="cartao space-y-3 border-destaque p-4">
      <h2 className="text-lg font-bold">{form?.id ? 'Editar produto' : 'Novo produto'}</h2>
      <Campo id="nome" rotulo="Nome" valor={form?.nome ?? ''} onChange={(v) => setForm({ ...form!, nome: v })} modo="text" autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <Campo id="preco" rotulo="Preço (R$)" valor={form?.preco ?? ''} onChange={(v) => setForm({ ...form!, preco: v })} modo="decimal" />
        <div className="space-y-1.5">
          <label htmlFor="unidade" className="rotulo block">
            Unidade
          </label>
          <input id="unidade" className="campo" list="lista-unidades" value={form?.unidade ?? ''} onChange={(e) => setForm({ ...form!, unidade: e.target.value })} />
          <datalist id="lista-unidades">
            {UNIDADES.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="categoria" className="rotulo block">
          Categoria (opcional)
        </label>
        <input
          id="categoria"
          className="campo"
          list="lista-categorias"
          placeholder="Ex.: Salgados, Doces, Bebidas"
          value={form?.categoria ?? ''}
          onChange={(e) => setForm({ ...form!, categoria: e.target.value })}
        />
        <datalist id="lista-categorias">
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <p className="text-xs text-sec">O preço é sugerido ao abrir um dia. Mudar aqui não altera dias que já passaram.</p>
      <div className="flex gap-2">
        <button type="button" className="btn-secundario flex-1" onClick={() => setForm(null)}>
          Cancelar
        </button>
        <button type="button" className="btn-primario flex-1" onClick={salvar} disabled={ocupado || !online}>
          Salvar
        </button>
      </div>
    </section>
  )

  const linha = (p: Produto) => (
    <li key={p.id} className={`cartao num flex items-center justify-between gap-3 px-4 py-3 ${p.ativo ? '' : 'opacity-60'}`}>
      <div className="min-w-0">
        <p className="truncate font-bold">{p.nome}</p>
        <p className="text-sm text-sec">
          {reais(p.preco)} / {p.unidade}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {p.ativo ? (
          <>
            <button
              type="button"
              className="btn min-h-11 px-3 text-claro hover:bg-destaque/10"
              onClick={() => setForm({ id: p.id, nome: p.nome, preco: numeroBR(p.preco), unidade: p.unidade, categoria: p.categoria ?? '' })}
              disabled={!online}
            >
              Editar
            </button>
            <button type="button" className="btn min-h-11 px-3 text-sec hover:text-alerta" onClick={() => executar(() => salvarProduto(p.id, { ativo: false }))} disabled={ocupado || !online}>
              Desativar
            </button>
          </>
        ) : (
          <button type="button" className="btn min-h-11 px-3 text-positivo" onClick={() => executar(() => salvarProduto(p.id, { ativo: true }))} disabled={ocupado || !online}>
            Reativar
          </button>
        )}
      </div>
    </li>
  )

  return (
    <Pagina largura="max-w-3xl" comNav>
      <TituloSecao
        titulo="Produtos"
        sub="Os ativos aparecem para escolher ao abrir um dia"
        acao={
          !form && (
            <button type="button" className="btn-primario shrink-0" onClick={() => setForm(vazio)} disabled={!online}>
              <Icone nome="mais" /> Novo
            </button>
          )
        }
      />
      {(erro || erroCarga) && (
        <div className="mb-3">
          <Aviso>{erro ?? erroCarga}</Aviso>
        </div>
      )}
      {form && <div className="mb-4">{editor}</div>}

      {carregando && !dados ? (
        <Carregando />
      ) : !ativos.length && !form ? (
        <Vazio>Nenhum produto ativo. Toque em Novo para cadastrar.</Vazio>
      ) : (
        <div className="space-y-5">
          {[...grupos.entries()]
            .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
            .map(([cat, ps]) => (
              <section key={cat || 'sem'}>
                {(categorias.length > 0 || cat) && (
                  <h2 className="mb-2 px-1">
                    <Selo cor={cat ? 'claro' : 'sec'}>{cat || 'Sem categoria'}</Selo>
                  </h2>
                )}
                <ul className="space-y-2">{ps.map(linha)}</ul>
              </section>
            ))}
        </div>
      )}

      {inativos.length > 0 && (
        <section className="mt-6">
          <button type="button" className="btn min-h-11 px-1 text-sm text-sec" onClick={() => setVerInativos(!verInativos)}>
            {verInativos ? 'Esconder' : 'Ver'} desativados ({inativos.length})
          </button>
          {verInativos && <ul className="mt-2 space-y-2">{inativos.map(linha)}</ul>}
        </section>
      )}
    </Pagina>
  )
}
