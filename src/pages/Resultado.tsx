import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { carregarDiaPorId, mensagemErro, type Dia } from '../lib/api'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { imagemDoSnapshot } from '../lib/resumo'
import ImagemResumo, { gerarPng, nomeArquivo } from '../components/ImagemResumo'
import { Aviso, Carregando, Icone, Pagina, Topo } from '../components/ui'

export default function Resultado() {
  const { diaId = '' } = useParams()
  const [dia, setDia] = useState<Dia | null | undefined>(undefined)
  const [png, setPng] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const no = useRef<HTMLDivElement>(null)

  useEffect(() => {
    carregarDiaPorId(diaId)
      .then((d) => setDia(d?.dia ?? null))
      .catch((e) => {
        setErro(mensagemErro(e))
        setDia(null)
      })
  }, [diaId])

  // Gera o PNG depois que o componente fora da tela foi montado
  useEffect(() => {
    if (!dia?.snapshot || !no.current) return
    let ativo = true
    gerarPng(no.current)
      .then((url) => ativo && setPng(url))
      .catch(() => ativo && setErro('Não foi possível gerar a imagem. Tente de novo.'))
    return () => {
      ativo = false
    }
  }, [dia])

  async function arquivo(): Promise<File> {
    const blob = await (await fetch(png!)).blob()
    return new File([blob], nomeArquivo(dia!.data), { type: 'image/png' })
  }

  function baixar() {
    const a = document.createElement('a')
    a.href = png!
    a.download = nomeArquivo(dia!.data)
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function compartilhar() {
    setMsg(null)
    try {
      const f = await arquivo()
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: `Resumo ${dataCurta(dia!.data)}` })
      } else {
        baixar()
        setMsg('Este aparelho não compartilha arquivos; a imagem foi baixada.')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') baixar()
    }
  }

  const titulo = 'Resumo do dia'
  if (dia === undefined) return <Pagina><Topo titulo={titulo} /><Carregando /></Pagina>
  if (!dia?.snapshot)
    return (
      <Pagina>
        <Topo titulo={titulo} />
        <Aviso>{erro ?? 'Este dia ainda não foi finalizado.'}</Aviso>
      </Pagina>
    )

  return (
    <Pagina>
      <Topo titulo={titulo} sub={`${diaDaSemana(dia.data)}, ${dataCurta(dia.data)}`} voltar="/" />

      <div className="cartao overflow-hidden p-2">
        {png ? (
          <img src={png} alt={`Resumo do dia ${dataCurta(dia.data)}`} className="block aspect-[4/5] w-full rounded-xl" />
        ) : (
          <div className="grid aspect-[4/5] w-full place-items-center text-sec">{erro ? '' : 'Gerando imagem…'}</div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {erro && <Aviso>{erro}</Aviso>}
        {msg && <Aviso tipo="info">{msg}</Aviso>}
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={compartilhar} disabled={!png}>
          <Icone nome="compartilhar" /> Compartilhar
        </button>
        <button type="button" className="btn-secundario min-h-12 w-full" onClick={baixar} disabled={!png}>
          <Icone nome="baixar" /> Baixar PNG
        </button>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/" className="btn-secundario min-h-12">
            Hoje
          </Link>
          <Link to={`/historico/${dia.id}`} className="btn-secundario min-h-12">
            Histórico
          </Link>
        </div>
      </div>

      {/* Componente da imagem, fora da tela, usado só para exportar */}
      <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}>
        <ImagemResumo ref={no} d={imagemDoSnapshot(dia.snapshot)} />
      </div>
    </Pagina>
  )
}
