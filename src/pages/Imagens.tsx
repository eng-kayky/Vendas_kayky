import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { carregarDia, mensagemErro } from '../lib/api'
import { dataCurta, diaDaSemana, hojeBelem } from '../lib/datas'
import { resumirDia } from '../lib/calculos'
import type { DiaCompleto } from '../lib/tipos'
import { baixar, compartilharOuBaixar, gerarPng, ImagemResumo, ImagemVendas, paginasDeVendas } from '../components/Imagens'
import { Aviso, Carregando, Icone, Pagina, Topo } from '../components/ui'

/** Imagens do dia (resumo + vendas por produto) para compartilhar. */
export default function Imagens() {
  const { diaId = '' } = useParams()
  const [d, setD] = useState<DiaCompleto | null | undefined>(undefined)
  const [pngs, setPngs] = useState<string[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const nos = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    carregarDia(diaId)
      .then(setD)
      .catch((e) => {
        setErro(mensagemErro(e))
        setD(null)
      })
  }, [diaId])

  const r = d ? resumirDia(d) : null
  const paginas = d ? paginasDeVendas(d) : []
  const total = 1 + paginas.length

  useEffect(() => {
    if (!d) return
    let ativo = true
    ;(async () => {
      try {
        const urls: string[] = []
        for (const no of nos.current.slice(0, total)) if (no) urls.push(await gerarPng(no))
        if (ativo) setPngs(urls)
      } catch {
        if (ativo) setErro('Não foi possível gerar as imagens. Tente de novo.')
      }
    })()
    return () => {
      ativo = false
    }
  }, [d]) // eslint-disable-line react-hooks/exhaustive-deps

  if (d === undefined) return <Pagina><Topo titulo="Imagens do dia" voltar={-1} /><Carregando /></Pagina>
  if (!d || !r) return <Pagina><Topo titulo="Imagens do dia" voltar={-1} /><Aviso>{erro ?? 'Dia não encontrado.'}</Aviso></Pagina>

  const nomes = Array.from({ length: total }, (_, i) => (i === 0 ? `resumo-${d.dia.data}.png` : `vendas-${d.dia.data}${total > 2 ? `-${i}` : ''}.png`))
  const voltar = d.dia.data === hojeBelem() ? '/' : `/dia/${d.dia.id}`

  return (
    <Pagina>
      <Topo titulo="Imagens do dia" sub={`${diaDaSemana(d.dia.data)}, ${dataCurta(d.dia.data)}`} voltar={voltar} />
      {d.dia.status === 'aberto' && (
        <div className="mb-3">
          <Aviso tipo="info">O dia ainda está aberto: as imagens mostram as vendas até agora, e o lucro só fica certo depois de informar o gasto.</Aviso>
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="cartao overflow-hidden p-2">
            {pngs?.[i] ? (
              <img src={pngs[i]} alt={i === 0 ? 'Resumo do dia' : `Vendas do dia, parte ${i}`} className="block aspect-[4/5] w-full rounded-xl" />
            ) : (
              <div className="grid aspect-[4/5] w-full place-items-center text-sec">{erro ? '' : 'Gerando imagem…'}</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {erro && <Aviso>{erro}</Aviso>}
        {msg && <Aviso tipo="info">{msg}</Aviso>}
        <button
          type="button"
          className="btn-primario min-h-14 w-full text-lg"
          disabled={!pngs}
          onClick={async () => {
            setMsg(null)
            const compartilhou = await compartilharOuBaixar(pngs!, nomes, `Resumo ${dataCurta(d.dia.data)}`)
            if (!compartilhou) setMsg('Este aparelho não compartilha arquivos; as imagens foram baixadas.')
          }}
        >
          <Icone nome="compartilhar" /> Compartilhar {total > 1 ? `${total} imagens` : 'imagem'}
        </button>
        <button type="button" className="btn-secundario min-h-12 w-full" onClick={() => baixar(pngs!, nomes)} disabled={!pngs}>
          <Icone nome="baixar" /> Baixar PNG
        </button>
        <Link to={voltar} className="btn min-h-12 w-full text-sec">
          Voltar ao dia
        </Link>
      </div>

      <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}>
        <ImagemResumo ref={(el) => (nos.current[0] = el)} d={d} r={r} />
        {paginas.map((b, i) => (
          <ImagemVendas key={i} ref={(el) => (nos.current[i + 1] = el)} d={d} r={r} blocos={b} pagina={i + 1} total={paginas.length} />
        ))}
      </div>
    </Pagina>
  )
}
