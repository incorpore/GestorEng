import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Smartphone } from 'lucide-react'
import { Button, Card, IconButton } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { dataHora } from '@/core/format'

export function Sessoes() {
  const qc = useQueryClient()
  const { logout } = useAuth()
  const q = useQuery({ queryKey: ['sessoes'], queryFn: () => api.get('/auth/sessoes') })
  return (
    <Card title="Sessões ativas" actions={<Button size="sm" variant="danger" onClick={async () => { await api.post('/auth/logout-all'); await logout() }}>Sair de todos os dispositivos</Button>}>
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {(q.data || []).map((s: any) => (
          <li key={s.id} className="flex items-center gap-3 py-2">
            <Smartphone className="h-4 w-4 text-slate-400" />
            <span className="min-w-0 flex-1"><span className="block truncate">{s.dispositivo || 'Dispositivo'}</span><span className="text-xs text-slate-500">{s.ip} · desde {dataHora(s.criado_em)}</span></span>
            <IconButton label="Encerrar" onClick={async () => { await api.del(`/auth/sessoes/${s.id}`); qc.invalidateQueries({ queryKey: ['sessoes'] }) }}><LogOut className="h-4 w-4" /></IconButton>
          </li>
        ))}
      </ul>
    </Card>
  )
}
