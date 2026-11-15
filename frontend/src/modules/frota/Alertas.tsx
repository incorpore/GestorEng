import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Card, Empty, Loading } from '@/components/ui'
import { api } from '@/core/api'
import { data } from '@/core/format'

const TXT: Record<string, string> = { licenciamento: 'Licenciamento vence', seguro: 'Seguro vence', revisao: 'Revisão atingida' }

export function AlertasFrota() {
  const q = useQuery({ queryKey: ['frota-alertas'], queryFn: () => api.get('/frota/alertas', { dias: 30 }) })
  if (q.isLoading) return <Loading />
  return (
    <Card title="Alertas (próximos 30 dias)">
      {!q.data?.length ? <Empty title="Sem alertas" /> : (
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {q.data.map((a: any, i: number) => (
            <li key={i} className="flex items-center gap-3 py-2"><AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="font-mono font-semibold">{a.veiculo}</span><span>{TXT[a.tipo]} {a.data ? data(a.data) : `(${a.leitura})`}</span></li>
          ))}
        </ul>
      )}
    </Card>
  )
}
