import { Button, Field, Input, Select } from '@/components/ui'
import { RelationSelect } from '../RelationSelect'
import type { FilterDef } from '../types'

/** Filtros da listagem (cadastro relacionado, data, sim/não ou opções). */
export function PainelFiltros({ filtros, valores, onChange }: {
  filtros: FilterDef[]; valores: Record<string, any>; onChange: (v: Record<string, any>) => void
}) {
  const set = (k: string, v: unknown) => onChange({ ...valores, [k]: v })
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/20 sm:grid-cols-4">
      {filtros.map((f) => (
        <Field key={f.name} label={f.label}>
          {f.type === 'relation' ? (
            <RelationSelect semCriar endpoint={f.relation!.endpoint} labelKey={f.relation!.labelKey} value={valores[f.name] ? Number(valores[f.name]) : null}
              onChange={(v) => set(f.name, v ?? '')} placeholder="Todos" />
          ) : f.type === 'date' ? (
            <Input type="date" value={valores[f.name] || ''} onChange={(e) => set(f.name, e.target.value)} />
          ) : (
            <Select value={valores[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
              <option value="">Todos</option>
              {(f.type === 'boolean' ? [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }] : f.options)?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          )}
        </Field>
      ))}
      <div className="flex items-end"><Button variant="ghost" onClick={() => onChange({})}>Limpar filtros</Button></div>
    </div>
  )
}
