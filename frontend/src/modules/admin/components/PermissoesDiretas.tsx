import { useQuery } from '@tanstack/react-query'
import { Select } from '@/components/ui'
import { api } from '@/core/api'

type D = { codigo: string; negar: boolean }

/** Concede ou nega permissões específicas para um usuário, além dos perfis. */
export function PermissoesDiretas({ value, onChange }: { value: D[]; onChange: (v: D[]) => void }) {
  const q = useQuery({ queryKey: ['catalogo-perms'], queryFn: () => api.get('/auth/permissoes'), staleTime: Infinity })
  const map = new Map(value.map((d) => [d.codigo, d]))
  const set = (codigo: string, modo: string) => {
    const n = value.filter((d) => d.codigo !== codigo)
    if (modo) n.push({ codigo, negar: modo === 'negar' })
    onChange(n)
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Exceções sobrepõem os perfis: “Conceder” adiciona a permissão; “Negar” remove mesmo que algum perfil a conceda.</p>
      {q.data?.map((m: any) => (
        <div key={m.modulo}>
          <h4 className="mb-1 text-xs font-semibold uppercase text-slate-400">{m.label}</h4>
          {m.permissoes.map((p: any) => {
            const d = map.get(p.codigo)
            return (
              <div key={p.codigo} className="flex items-center justify-between gap-2 py-0.5 text-sm">
                <span>{p.label}</span>
                <Select className="w-32 py-1 text-xs" value={d ? (d.negar ? 'negar' : 'conceder') : ''} onChange={(e) => set(p.codigo, e.target.value)}>
                  <option value="">Perfil</option><option value="conceder">Conceder</option><option value="negar">Negar</option>
                </Select>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
