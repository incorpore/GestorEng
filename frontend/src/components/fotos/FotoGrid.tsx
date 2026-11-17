import { useQuery } from '@tanstack/react-query'
import { ImageIcon, MapPin } from 'lucide-react'
import { signedUrl } from '@/core/files'
import { api } from '@/core/api'
import { absUrl } from '@/core/platform'

export interface Foto {
  id: number; nome: string; mime: string; descricao?: string | null; largura?: number | null; altura?: number | null
  capturado_em?: string | null; latitude?: number | null; longitude?: number | null; coord_fonte?: string | null
  origem?: string | null; enviado_por_nome?: string | null; tem_original?: boolean; tamanho: number; created_at: string
}

async function miniatura(id: number) {
  const { url } = await api.get<{ url: string }>(`/arquivos/${id}/link`, { miniatura: true })
  return absUrl(url)
}

export function Miniatura({ foto, className }: { foto: Foto; className?: string }) {
  const q = useQuery({ queryKey: ['mini', foto.id], queryFn: () => miniatura(foto.id), staleTime: 8 * 60_000 })
  return q.data ? <img src={q.data} alt={foto.descricao || foto.nome} loading="lazy" className={className} />
    : <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${className}`}><ImageIcon className="h-6 w-6 text-slate-300" /></div>
}

export const dataCurta = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Grade que mostra cada foto na sua proporção (verticais mais estreitas, horizontais mais largas). */
export function FotoGrid({ fotos, onAbrir }: { fotos: Foto[]; onAbrir: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {fotos.map((f, i) => {
        const prop = f.largura && f.altura ? Math.max(0.5, Math.min(2, f.largura / f.altura)) : 4 / 3
        return (
          <button key={f.id} type="button" onClick={() => onAbrir(i)} style={{ flexGrow: prop, flexBasis: `${prop * 120}px` }}
            className="group relative overflow-hidden rounded-xl bg-slate-100 text-left dark:bg-slate-800">
            <div style={{ paddingBottom: `${100 / prop}%` }} />
            <Miniatura foto={f} className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
              {f.descricao && <p className="truncate text-xs font-semibold">{f.descricao}</p>}
              <p className="flex items-center gap-1 text-[10px] opacity-90">
                {f.latitude != null && <MapPin className="h-3 w-3" />}{dataCurta(f.capturado_em || f.created_at)}
                {f.origem === 'link' && <span className="ml-1 rounded bg-white/25 px-1">via link</span>}
              </p>
            </div>
          </button>
        )
      })}
      <div style={{ flexGrow: 10 }} />
    </div>
  )
}

export { signedUrl }
