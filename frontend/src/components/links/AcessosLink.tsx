import { useQuery } from '@tanstack/react-query'
import { ExternalLink, MapPin } from 'lucide-react'
import { Badge, Loading } from '@/components/ui'
import { api } from '@/core/api'
import { dataHora } from '@/core/format'
import { linkMapa } from '@/core/geo'
import { type Acesso, EVENTO } from './tipos'

const TOM: Record<string, string> = { localizacao: 'green', localizacao_negada: 'red', enviou_foto: 'blue', baixou_pdf: 'purple' }

/** Registro de acessos do link: data/hora, evento, IP, aparelho e coordenadas (com link para o mapa). */
export function AcessosLink({ linkId }: { linkId: number }) {
  const q = useQuery({ queryKey: ['link-acessos', linkId], queryFn: () => api.get<Acesso[]>(`/links-publicos/${linkId}/acessos`), refetchInterval: 15000 })
  if (q.isLoading) return <Loading />
  if (!q.data?.length) return <p className="py-4 text-center text-sm text-slate-400">Nenhum acesso ainda.</p>
  return (
    <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
      {q.data.map((a) => (
        <li key={a.id} className="space-y-0.5 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TOM[a.evento] || 'gray'}>{EVENTO[a.evento] || a.evento}</Badge>
            <span className="text-xs text-slate-500">{dataHora(a.at)}</span>
            {a.nome && <span className="text-xs font-medium">{a.nome}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
            <span>IP <code className="text-slate-700 dark:text-slate-300">{a.ip || '—'}</code></span>
            {a.latitude != null && a.longitude != null && (
              <a href={linkMapa(a.latitude, a.longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary">
                <MapPin className="h-3 w-3" />{a.latitude.toFixed(6)}, {a.longitude.toFixed(6)}{a.precisao ? ` (±${Math.round(a.precisao)} m)` : ''}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {a.user_agent && <p className="truncate text-[11px] text-slate-400" title={a.user_agent}>{a.user_agent}</p>}
        </li>
      ))}
    </ul>
  )
}
