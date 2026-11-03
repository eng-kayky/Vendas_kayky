import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { carregarDiaPorId, mensagemErro, situacaoFiados, type Dia } from '../lib/api'
import { dataCurta, diaDaSemana } from '../lib/datas'
import { imagemDoSnapshot, type SituacaoFiado } from '../lib/resumo'
import ImagemResumo, { gerarPng, ImagemVendas, nomeArquivo, paginasDeVendas } from '../components/ImagemResumo'
import { Aviso, Carregando, Icone, Pagina, Topo } from '../components/ui'

export default function Resultado() {
  const { diaId = '' } = useParams()
  const [dia, setDia] = useState<Dia | null | undefined>(undefined)
  const [situacao, setSituacao] = useState<SituacaoFiado | null>(null)
  const [pngs, setPngs] = useState<string[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const nos = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const d = (await carregarDiaPorId(diaId))?.dia ?? null
        // Situação atual dos fiados desse dia (pago depois aparece aqui, no dia da venda)
        const fiados = (d?.snapshot?.vendas_lista ?? []).filter((v) => v.pagamento === 'fiado').map((v) => v.venda_id)
        setSituacao(await situacaoFiados(fiados))
        setDia(d)
      } catch (e) {
        setErro(mensagemErro(e))
        setDia(null)
      }
    })()
  }, [diaId])

  const dados = dia?.snapshot ? imagemDoSnapshot(dia.snapshot) : null
  const paginas = dados ? paginasDeVendas(dados) : []

  // Gera os PNGs depois que os componentes fora da tela foram montados
  useEffect(() => {
    if (!dados || situacao === null) return
    let ativo = true
    ;(async () => {
      try {
        const urls: string[] = []
        for (const no of nos.current.slice(0, 1 + paginas.length)) if (no) urls.push(await gerarPng(no))
        if (ativo) setPngs(urls)
      } catch {
        if (ativo) setErro('Não foi possível gerar a imagem. Tente de novo.')
      }
    })()
    return () => {
      ativo = false
    }
  }, [dia, situacao]) // eslint-disable-line react-hooks/exhaustive-deps

  async function arquivos(): Promise<File[]> {
    return Promise.all(
      pngs!.map(async (url, i) => new File([await (await fetch(url)).blob()], nomeArquivo(dia!.data, i || undefined), { type: 'image/png' })),
    )
  }

  function baixar() {
    pngs!.forEach((url, i) => {
      const a = document.createElement('a')
      a.href = url
      a.download = nomeArquivo(dia!.data, i || undefined)
      document.body.appendChild(a)
      a.click()
      a.remove()
    })
  }

  async function compartilhar() {
    setMsg(null)
    try {
      const fs = await arquivos()
      if (navigator.canShare?.({ files: fs })) {
        await navigator.share({ files: fs, title: `Resumo ${dataCurta(dia!.data)}` })
      } else {
        baixar()
        setMsg('Este aparelho não compartilha arquivos; as imagens foram baixadas.')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') baixar()
    }
  }

  const titulo = 'Resumo do dia'
  if (dia === undefined) return <Pagina><Topo titulo={titulo} /><Carregando /></Pagina>
  if (!dia?.snapshot || !dados)
    return (
      <Pagina>
        <Topo titulo={titulo} />
        <Aviso>{erro ?? 'Este dia ainda não foi finalizado.'}</Aviso>
      </Pagina>
    )

  const total = 1 + paginas.length

  return (
    <Pagina>
      <Topo titulo={titulo} sub={`${diaDaSemana(dia.data)}, ${dataCurta(dia.data)}`} voltar="/" />

      <div className="space-y-3">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="cartao overflow-hidden p-2">
            {pngs?.[i] ? (
              <img
                src={pngs[i]}
                alt={i === 0 ? `Resumo do dia ${dataCurta(dia.data)}` : `Vendas do dia ${dataCurta(dia.data)}, parte ${i}`}
                className="block aspect-[4/5] w-full rounded-xl"
              />
            ) : (
              <div className="grid aspect-[4/5] w-full place-items-center text-sec">{erro ? '' : 'Gerando imagem…'}</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {erro && <Aviso>{erro}</Aviso>}
        {msg && <Aviso tipo="info">{msg}</Aviso>}
        <button type="button" className="btn-primario min-h-14 w-full text-lg" onClick={compartilhar} disabled={!pngs}>
          <Icone nome="compartilhar" /> Compartilhar {total > 1 ? `${total} imagens` : ''}
        </button>
        <button type="button" className="btn-secundario min-h-12 w-full" onClick={baixar} disabled={!pngs}>
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

      {/* Componentes das imagens, fora da tela, usados só para exportar */}
      <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}>
        <ImagemResumo ref={(el) => (nos.current[0] = el)} d={dados} situacao={situacao ?? {}} />
        {paginas.map((vs, i) => (
          <ImagemVendas
            key={i}
            ref={(el) => (nos.current[i + 1] = el)}
            d={dados}
            vendas={vs}
            pagina={i + 1}
            total={paginas.length}
            situacao={situacao ?? {}}
          />
        ))}
      </div>
    </Pagina>
  )
}
