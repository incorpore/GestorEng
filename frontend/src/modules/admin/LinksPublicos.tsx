import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Card, Empty, Loading } from '@/components/ui'
import { AcessosLink } from '@/components/links/AcessosLink'
import type { LinkPublico } from '@/components/links/tipos'
import { api } from '@/core/api'
import { dataHora } from '@/core/format'

/** Todos os links públicos e seus acessos (IP, aparelho, coordenadas) para auditoria. */
export function LinksPublicos() {
  const q = useQuery({ queryKey: ['links-todos'], queryFn: () => api.get<(LinkPublico & { entidade: string; entidade_id: number })[]>('/links-publicos') })
  const [aberto, setAberto] = useState<number | null>(null)
  if (q.isLoading) return <Loading />
  if (!q.data?.length) return <Empty title="Nenhum link público criado" />
  return (
    <Card padded={false}>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {q.data.map((l) => (
          <li key={l.id} className="px-4 py-3">
            <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setAberto(aberto === l.id ? null : l.id)}>
              <span><span className="font-medium">{l.tipo === 'fotos' ? 'Pedido de fotos' : 'Visualização'} — {l.entidade} #{l.entidade_id}</span>
                {l.destinatario && <span className="text-sm text-slate-500"> · {l.destinatario}</span>}
                <span className="block text-xs text-slate-500">criado {dataHora(l.created_at)} · expira {dataHora(l.expira_em)} · {l.acessos} acesso(s){l.tipo === 'fotos' && ` · ${l.fotos_recebidas} foto(s)`}</span></span>
              <Badge tone={l.ativo ? 'green' : 'gray'}>{l.ativo ? 'ativo' : 'inativo'}</Badge>
            </button>
            {aberto === l.id && <div className="mt-2"><AcessosLink linkId={l.id} /></div>}
          </li>
        ))}
      </ul>
    </Card>
  )
}
