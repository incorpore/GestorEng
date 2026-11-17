import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { api } from '@/core/api'

export interface CampoPos { indice: number; pagina: number; x: number; y: number; largura: number; altura: number }
const CORES = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4b5563']
export const corAssinante = (i: number) => CORES[i % CORES.length]
const LARGURA = 28
const ALTURA = 6

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any> }

/** Marcação manual dos locais de assinatura: escolha a pessoa, vá até a página e clique onde ela assina.
 *  O retângulo pode ser arrastado para ajustar ou removido no "x". */
export function PosicoesAssinatura({ docId, campos, nomes, ativo, onChange }: {
  docId: number; campos: CampoPos[]; nomes: string[]; ativo: number | null; onChange: (c: CampoPos[]) => void
}) {
  const pdf = useRef<PdfDoc | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [imagem, setImagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        const dados = await (await api.blob(`/documentos-acoes/${docId}/pdf`)).arrayBuffer()
        const doc = await pdfjs.getDocument({ data: dados, isEvalSupported: false }).promise
        if (!vivo) return
        pdf.current = doc
        setTotal(doc.numPages)
        setPagina(doc.numPages) // assinaturas costumam ficar na última página
      } catch (e: any) { if (vivo) setErro(e?.message || 'Não foi possível abrir o PDF') }
    })()
    return () => { vivo = false }
  }, [docId])

  useEffect(() => {
    if (!pdf.current || !pagina) return
    let vivo = true
    setImagem(null)
    ;(async () => {
      const page = await pdf.current!.getPage(pagina)
      const vp = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width = vp.width; canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
      if (vivo) setImagem(canvas.toDataURL('image/png'))
    })().catch((e) => vivo && setErro(e?.message || 'Falha ao exibir a página'))
    return () => { vivo = false }
  }, [pagina, total])

  if (erro) return <p className="text-xs text-rose-600">{erro}</p>
  if (!total) return <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo o documento...</p>
  const marcadasAqui = campos.filter((c) => c.pagina === pagina).length

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <button type="button" className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900"
          disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}><ChevronLeft className="h-4 w-4" />Anterior</button>
        <span className="text-slate-600 dark:text-slate-300">Página {pagina} de {total}{marcadasAqui ? ` · ${marcadasAqui} assinatura(s) aqui` : ''}</span>
        <button type="button" className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900"
          disabled={pagina >= total} onClick={() => setPagina(pagina + 1)}>Próxima<ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {!imagem ? <p className="flex items-center gap-2 p-6 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando a página...</p>
          : <Pagina n={pagina} url={imagem} campos={campos} nomes={nomes} ativo={ativo} onChange={onChange} />}
      </div>
    </div>
  )
}

function Pagina({ n, url, campos, nomes, ativo, onChange }: {
  n: number; url: string; campos: CampoPos[]; nomes: string[]; ativo: number | null; onChange: (c: CampoPos[]) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const arraste = useRef<{ k: number; px: number; py: number; x: number; y: number; moveu: boolean } | null>(null)

  function marcar(e: React.MouseEvent) {
    if (ativo === null || !ref.current || e.target !== e.currentTarget.querySelector('img')) return
    const r = ref.current.getBoundingClientRect()
    const cx = ((e.clientX - r.left) / r.width) * 100
    const cy = ((e.clientY - r.top) / r.height) * 100
    // o clique marca o meio da linha de assinatura: o retângulo fica centralizado e logo acima do ponto
    const novo: CampoPos = { indice: ativo, pagina: n, largura: LARGURA, altura: ALTURA,
      x: +Math.min(Math.max(cx - LARGURA / 2, 0), 100 - LARGURA).toFixed(2), y: +Math.min(Math.max(cy - ALTURA, 0), 100 - ALTURA).toFixed(2) }
    onChange([...campos.filter((c) => c.indice !== ativo), novo])
  }

  function mover(e: React.PointerEvent) {
    const a = arraste.current
    if (!a || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const c = campos[a.k]
    const x = Math.min(Math.max(a.x + ((e.clientX - a.px) / r.width) * 100, 0), 100 - c.largura)
    const y = Math.min(Math.max(a.y + ((e.clientY - a.py) / r.height) * 100, 0), 100 - c.altura)
    a.moveu = true
    onChange(campos.map((cc, i) => (i === a.k ? { ...cc, x: +x.toFixed(2), y: +y.toFixed(2) } : cc)))
  }

  return (
    <div ref={ref} className={`relative mx-auto w-full max-w-2xl touch-none select-none bg-white shadow ${ativo !== null ? 'cursor-crosshair' : ''}`}
      onClick={marcar} onPointerMove={mover} onPointerUp={() => { arraste.current = null }}>
      <img src={url} alt={`Página ${n}`} className="block w-full" draggable={false} />
      {campos.map((c, k) => c.pagina !== n ? null : (
        <div key={k} role="button" aria-label={`Assinatura de ${nomes[c.indice]}`} title="Arraste para ajustar"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); arraste.current = { k, px: e.clientX, py: e.clientY, x: c.x, y: c.y, moveu: false } }}
          className="absolute flex cursor-move items-center justify-center rounded border-2 text-[10px] font-semibold"
          style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.largura}%`, height: `${c.altura}%`, borderColor: corAssinante(c.indice), background: `${corAssinante(c.indice)}22`, color: corAssinante(c.indice) }}>
          <span className="truncate px-1">{nomes[c.indice] || `Assinante ${c.indice + 1}`}</span>
          <button type="button" aria-label={`Remover assinatura de ${nomes[c.indice]}`} onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onChange(campos.filter((_, i) => i !== k)) }}
            className="absolute -right-2 -top-2 rounded-full bg-white p-0.5 shadow" style={{ color: corAssinante(c.indice) }}><X className="h-3 w-3" /></button>
        </div>
      ))}
    </div>
  )
}
