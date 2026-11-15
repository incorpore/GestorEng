import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui'
import { data } from '@/core/format'

export function AlertasFrotaCard({ itens }: { itens: any[] }) {
  if (!itens.length) return null
  return (
    <Card title="Alertas de frota">
      <ul className="space-y-1 text-sm">
        {itens.slice(0, 6).map((a, i) => (
          <li key={i} className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="font-mono">{a.veiculo}</span>
            <span className="text-slate-500">{a.tipo} {a.data ? data(a.data) : ''}</span></li>
        ))}
      </ul>
    </Card>
  )
}
