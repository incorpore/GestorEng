import type { ComponentType } from 'react'
import { Calendar, MapPin, User } from 'lucide-react'
import { Card } from '@/components/ui'
import { data } from '@/core/format'
import { Progress } from '../config'

/** Ficha da obra: contratante, local, prazo, responsáveis, objeto e avanço. */
export function DadosObra({ obra: o }: { obra: any }) {
  return (
    <Card title="Dados da obra">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info icon={User} label="Contratante" value={o.cliente_nome} />
        <Info icon={MapPin} label="Local" value={[o.endereco, o.cidade && `${o.cidade}/${o.uf || ''}`].filter(Boolean).join(' — ')} />
        <Info icon={Calendar} label="Prazo" value={`${data(o.data_inicio)} → ${data(o.data_prevista_fim)}${o.prazo_dias ? ` (${o.prazo_dias} dias)` : ''}`} />
        <Info label="Responsável técnico" value={[o.responsavel_tecnico, o.crea_cau].filter(Boolean).join(' · ')} />
        <Info label="ART/RRT" value={o.art_rrt} />
        <Info label="Fiscal do contrato" value={o.fiscal_contrato} />
      </dl>
      {o.objeto && <p className="mt-4 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300"><strong>Objeto: </strong>{o.objeto}</p>}
      <div className="mt-4"><Progress v={o.progresso} /></div>
    </Card>
  )
}

function Info({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-slate-400">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</dt>
      <dd className="mt-0.5">{value || '—'}</dd>
    </div>
  )
}
