import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ExternalLink, MapPin, Trash2, X } from 'lucide-react'
import { api } from '@/core/api'
import { signedUrl } from '@/core/files'
import { absUrl } from '@/core/platform'
import { linkMapa } from '@/core/geo'
import { dataCurta, type Foto } from './FotoGrid'

const FONTE: Record<string, string> = { exif: 'GPS da câmera', dispositivo: 'localização do aparelho', obra: 'coordenadas da obra' }

/** Visualizador em tela cheia com navegação, dados de captura e mapa. */
export function FotoViewer({ fotos, indice, onFechar, onExcluir, podeOriginal }: {
  fotos: Foto[]; indice: number; onFechar: () => void; onExcluir?: (f: Foto) => void; podeOriginal?: boolean
}) {
  const [i, setI] = useState(indice)
  const [url, setUrl] = useState<string | null>(null)
  const f = fotos[i]
  useEffect(() => { setUrl(null); if (f) signedUrl(f.id).then(setUrl) }, [f])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
      if (e.key === 'ArrowRight') setI((x) => Math.min(fotos.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [fotos.length, onFechar])
  if (!f) return null
  const btn = 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20'
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal="true">
      <div className="safe-top flex items-center justify-between gap-2 p-3 text-white">
        <span className="text-sm opacity-80">{i + 1} / {fotos.length}</span>
        <div className="flex gap-2">
          {podeOriginal && f.tem_original && <button className={btn} title="Baixar original (sem marca d'água)"
            onClick={async () => { const r = await api.get<{ url: string }>(`/arquivos/${f.id}/link`, { original: true }); window.open(absUrl(r.url), '_blank') }}><Download className="h-5 w-5" /></button>}
          {onExcluir && <button className={btn} title="Excluir" onClick={() => onExcluir(f)}><Trash2 className="h-5 w-5" /></button>}
          <button className={btn} title="Fechar" onClick={onFechar}><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {url ? <img src={url} alt={f.descricao || f.nome} className="max-h-full max-w-full object-contain" /> : <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
        {i > 0 && <button className={`${btn} absolute left-3`} onClick={() => setI(i - 1)}><ChevronLeft className="h-6 w-6" /></button>}
        {i < fotos.length - 1 && <button className={`${btn} absolute right-3`} onClick={() => setI(i + 1)}><ChevronRight className="h-6 w-6" /></button>}
      </div>
      <div className="safe-bottom space-y-1 p-4 text-sm text-white">
        {f.descricao && <p className="font-semibold">{f.descricao}</p>}
        <p className="opacity-80">{dataCurta(f.capturado_em || f.created_at)}{f.enviado_por_nome && ` · enviada por ${f.enviado_por_nome}`}</p>
        {f.latitude != null && f.longitude != null && (
          <a href={linkMapa(f.latitude, f.longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300">
            <MapPin className="h-4 w-4" />{f.latitude.toFixed(6)}, {f.longitude.toFixed(6)} ({FONTE[f.coord_fonte || ''] || 'localização'})<ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}
