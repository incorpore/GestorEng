import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Card, Input, Loading, Pagination } from '@/components/ui'
import { api } from '@/core/api'
import { dataHora } from '@/core/format'

export function Auditoria() {
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const q = useQuery({ queryKey: ['/auditoria', page, entity], queryFn: () => api.get('/auditoria', { page, page_size: 50, entity: entity || undefined }) })
  return (
    <Card padded={false}>
      <div className="p-3"><Input placeholder="Filtrar por entidade (obra, documento, usuario, auth...)" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }} /></div>
      {q.isLoading ? <Loading /> : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th><th>IP</th></tr></thead>
            <tbody>
              {q.data.items.map((a: any) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-xs">{dataHora(a.at)}</td><td>{a.usuario || '—'}</td><td>{a.action}</td><td>{a.entity} {a.entity_id && `#${a.entity_id}`}</td>
                  <td className="max-w-md"><code className="line-clamp-2 break-all text-[11px] text-slate-500">{a.data ? JSON.stringify(a.data) : ''}</code></td><td className="text-xs">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3"><Pagination page={page} pageSize={50} total={q.data.total} onChange={setPage} /></div>
        </div>
      )}
    </Card>
  )
}
