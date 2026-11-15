import { Link } from 'react-router-dom'
import { Badge, Card } from '@/components/ui'
import { dataHora } from '@/core/format'
import { label, STATUS_LICITACAO } from '@/core/options'

export function ListaLicitacoes({ itens }: { itens: any[] }) {
  return (
    <Card title="Próximas aberturas" actions={<Link to="/licitacoes" className="text-xs text-primary">ver todas</Link>}>
      {!itens.length ? <p className="text-sm text-slate-400">Nenhuma licitação agendada.</p> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {itens.map((l) => (
            <li key={l.id} className="py-2 text-sm">
              <p className="line-clamp-2">{l.objeto}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">{dataHora(l.abertura)} · {l.orgao} <Badge>{label(STATUS_LICITACAO, l.status)}</Badge></p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
