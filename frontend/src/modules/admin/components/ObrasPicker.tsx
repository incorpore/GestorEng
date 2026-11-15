import { useQuery } from '@tanstack/react-query'
import { Toggle } from '@/components/ui'
import { api } from '@/core/api'

/** Restringe o usuário a obras específicas (escopo de dados). */
export function ObrasPicker({ restrito, ids, onChange }: { restrito: boolean; ids: number[]; onChange: (restrito: boolean, ids: number[]) => void }) {
  const q = useQuery({ queryKey: ['/obras', 'all'], queryFn: () => api.get('/obras', { page_size: 500, order: 'nome' }), enabled: restrito })
  return (
    <div className="space-y-3">
      <Toggle checked={restrito} onChange={(r) => onChange(r, ids)} label="Restringir acesso às obras selecionadas" />
      <p className="text-xs text-slate-500">Quando ativo, o usuário só vê obras, diários, medições, apontamentos, documentos e lançamentos das obras marcadas.</p>
      {restrito && (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {q.data?.items.map((o: any) => (
            <li key={o.id}><label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ids.includes(o.id)} onChange={(e) => onChange(true, e.target.checked ? [...ids, o.id] : ids.filter((x) => x !== o.id))} />{o.nome}
            </label></li>
          ))}
        </ul>
      )}
    </div>
  )
}
