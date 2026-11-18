import { ClipboardList } from 'lucide-react'
import { Card } from '@/components/ui'
import { data } from '@/core/format'

/** Pendências ainda abertas no último diário da obra. */
export function PendenciasObra({ pendencias }: { pendencias?: any[] }) {
  return (
    <Card title={<span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-orange-500" />Pendências em aberto
      <span className="rounded-full bg-slate-100 px-2 text-xs font-normal dark:bg-slate-800">{pendencias?.length ?? 0}</span></span>}>
      {!pendencias?.length ? <p className="text-sm text-slate-400">Nenhuma pendência em aberto no último diário.</p> : (
        <ul className="space-y-2 text-sm">{pendencias.map((p) => (
          <li key={p.id} className="rounded-lg bg-orange-50 p-2 dark:bg-orange-950/30"><p>{p.descricao}</p>
            <p className="text-xs text-slate-500">{[p.responsavel, p.prazo && `prazo ${data(p.prazo)}`, p.origem_data && `desde ${data(p.origem_data)}`].filter(Boolean).join(' · ')}</p></li>
        ))}</ul>
      )}
    </Card>
  )
}
