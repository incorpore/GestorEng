import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { data } from '@/core/format'
import { Progress } from '../../obras/config'

export function ListaObras({ itens }: { itens: any[] }) {
  return (
    <Card title="Obras em andamento" actions={<Link to="/obras" className="text-xs text-primary">ver todas</Link>}>
      {!itens.length ? <p className="text-sm text-slate-400">Nenhuma obra em andamento.</p> : (
        <ul className="space-y-3">
          {itens.map((o) => (
            <li key={o.id}><Link to={`/obras/${o.id}`} className="block">
              <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{o.nome}</span><span className="shrink-0 text-xs text-slate-400">até {data(o.fim)}</span></div>
              <div className="mt-1 flex items-center justify-between"><span className="text-xs text-slate-500">{o.cliente}</span><Progress v={o.progresso} /></div>
            </Link></li>
          ))}
        </ul>
      )}
    </Card>
  )
}
