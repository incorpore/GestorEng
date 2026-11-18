import { useRef } from 'react'
import { X } from 'lucide-react'
import { ALTURA, type CampoPos, corAssinante, LARGURA } from './campos'

/** Uma página do PDF: clique marca o campo da pessoa ativa; retângulos arrastáveis e removíveis. */
export function PaginaMarcacao({ n, url, campos, nomes, ativo, onChange }: {
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
    // um campo por pessoa em cada página: clicar de novo na mesma página move o campo dela
    onChange([...campos.filter((c) => !(c.indice === ativo && c.pagina === n)), novo])
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
