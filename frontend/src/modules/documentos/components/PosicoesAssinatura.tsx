import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/core/api'

export interface CampoPos { indice: number; pagina: number; x: number; y: number; largura: number; altura: number; origem?: string; referencia?: string }
const CORES = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4b5563']
export const corAssinante = (i: number) => CORES[i % CORES.length]

/** Mostra as páginas do PDF com os retângulos de assinatura de cada pessoa; arraste para ajustar a posição. */
export function PosicoesAssinatura({ docId, campos, nomes, onChange }: {
  docId: number; campos: CampoPos[]; nomes: string[]; onChange: (c: CampoPos[]) => void
}) {
  const [paginas, setPaginas] = useState<{ n: number; url: string; w: number; h: number }[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const usadas = [...new Set(campos.map((c) => c.pagina))].sort((a, b) => a - b)
  const chave = usadas.join(',')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        const dados = await (await api.blob(`/documentos-acoes/${docId}/pdf`)).arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: dados, isEvalSupported: false }).promise
        const out = []
        for (const n of usadas.length ? usadas : [pdf.numPages]) {
          const page = await pdf.getPage(n)
          const vp = page.getViewport({ scale: 1.4 })
          const canvas = document.createElement('canvas')
          canvas.width = vp.width; canvas.height = vp.height
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
          out.push({ n, url: canvas.toDataURL('image/png'), w: vp.width, h: vp.height })
        }
        if (vivo) setPaginas(out)
      } catch (e: any) { if (vivo) setErro(e?.message || 'Não foi possível exibir o PDF') }
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, chave])

  if (erro) return <p className="text-xs text-rose-600">{erro}</p>
  if (!paginas) return <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando a pré-visualização...</p>
  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-800">
      {paginas.map((p) => <Pagina key={p.n} p={p} campos={campos} nomes={nomes} onChange={onChange} />)}
    </div>
  )
}

function Pagina({ p, campos, nomes, onChange }: {
  p: { n: number; url: string; w: number; h: number }; campos: CampoPos[]; nomes: string[]; onChange: (c: CampoPos[]) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const arraste = useRef<{ k: number; px: number; py: number; x: number; y: number } | null>(null)

  function mover(e: React.PointerEvent) {
    const a = arraste.current
    if (!a || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const c = campos[a.k]
    const x = Math.min(Math.max(a.x + ((e.clientX - a.px) / r.width) * 100, 0), 100 - c.largura)
    const y = Math.min(Math.max(a.y + ((e.clientY - a.py) / r.height) * 100, 0), 100 - c.altura)
    onChange(campos.map((cc, i) => (i === a.k ? { ...cc, x: +x.toFixed(2), y: +y.toFixed(2), origem: 'manual' } : cc)))
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-500">Página {p.n}</p>
      <div ref={ref} className="relative mx-auto w-full max-w-2xl touch-none select-none bg-white shadow" onPointerMove={mover}
        onPointerUp={() => { arraste.current = null }} onPointerLeave={() => { arraste.current = null }}>
        <img src={p.url} alt={`Página ${p.n}`} className="block w-full" draggable={false} />
        {campos.map((c, k) => c.pagina !== p.n ? null : (
          <div key={k} role="button" aria-label={`Assinatura de ${nomes[c.indice]}`} title="Arraste para ajustar"
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); arraste.current = { k, px: e.clientX, py: e.clientY, x: c.x, y: c.y } }}
            className="absolute flex cursor-move items-center justify-center overflow-hidden rounded border-2 text-[10px] font-semibold"
            style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.largura}%`, height: `${c.altura}%`, borderColor: corAssinante(c.indice), background: `${corAssinante(c.indice)}22`, color: corAssinante(c.indice) }}>
            <span className="truncate px-1">{nomes[c.indice] || `Assinante ${c.indice + 1}`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
