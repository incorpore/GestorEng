import { useQuery } from '@tanstack/react-query'
import { Loading } from '@/components/ui'
import { api } from '@/core/api'

/** Matriz de permissões agrupada por módulo (com marcar/desmarcar módulo inteiro). */
export function PermissoesEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const q = useQuery({ queryKey: ['catalogo-perms'], queryFn: () => api.get('/auth/permissoes'), staleTime: Infinity })
  if (q.isLoading) return <Loading />
  const set = new Set(value)
  const toggle = (codes: string[], on: boolean) => {
    const n = new Set(set)
    codes.forEach((c) => (on ? n.add(c) : n.delete(c)))
    onChange([...n])
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {q.data.map((m: any) => {
        const codes = m.permissoes.map((p: any) => p.codigo)
        const all = codes.every((c: string) => set.has(c))
        return (
          <fieldset key={m.modulo} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 text-sm font-semibold">
              <label className="flex items-center gap-2"><input type="checkbox" checked={all} onChange={(e) => toggle(codes, e.target.checked)} />{m.label}</label>
            </legend>
            <div className="space-y-1">
              {m.permissoes.map((p: any) => (
                <label key={p.codigo} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={set.has(p.codigo)} onChange={(e) => toggle([p.codigo], e.target.checked)} />
                  <span>{p.label.split(': ').slice(1).join(': ') || p.label}</span>
                  <code className="ml-auto text-[10px] text-slate-400">{p.codigo}</code>
                </label>
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
