import { Input, Select, Textarea, Toggle } from '@/components/ui'
import { GeoInput, MunicipioSelect, UfSelect } from './LocalidadeInputs'
import { RelationSelect } from './RelationSelect'
import type { FieldDef } from './types'

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

export function FieldInput({ f, value, onChange, values = {}, set }: {
  f: FieldDef; value: any; onChange: (v: any) => void; values?: Record<string, any>; set?: (k: string, v: any) => void
}) {
  const t = f.type || 'text'
  const common = { id: f.name, required: f.required, readOnly: f.readOnly, placeholder: f.placeholder }
  switch (t) {
    case 'textarea':
      return <Textarea {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} />
    case 'number':
    case 'money':
    case 'percent':
      return (
        <div className="relative">
          {t === 'money' && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>}
          <Input {...common} type="number" inputMode="decimal" step={f.step || (t === 'number' ? 'any' : '0.01')}
            className={t === 'money' ? 'pl-9' : t === 'percent' ? 'pr-8' : ''}
            value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
          {t === 'percent' && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>}
        </div>
      )
    case 'date':
      return <Input {...common} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    case 'datetime':
      return <Input {...common} type="datetime-local" value={value ? String(value).slice(0, 16) : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />
    case 'select':
      return (
        <Select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}>
          {!f.required && <option value="">—</option>}
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      )
    case 'uf':
      return <UfSelect disabled={f.readOnly} value={value ?? null} onChange={onChange} />
    case 'municipio':
      return <MunicipioSelect disabled={f.readOnly} uf={f.ufField ? values[f.ufField] : null} value={value ?? null}
        onChange={(nome, ibge) => { onChange(nome); if (f.ibgeField && set) set(f.ibgeField, ibge ? String(ibge) : null) }} />
    case 'geo':
      return <GeoInput disabled={f.readOnly} value={value ?? null} onChange={onChange}
        onCoords={(lat, lon) => { onChange(lat); if (f.lonField && set) set(f.lonField, lon) }} />
    case 'relation':
      return <RelationSelect endpoint={f.relation!.endpoint} labelKey={f.relation!.labelKey} params={f.relation!.params}
        value={value} onChange={(v) => onChange(v)} disabled={f.readOnly} />
    case 'boolean':
      return <div className="pt-1.5"><Toggle checked={!!value} onChange={onChange} label={value ? 'Sim' : 'Não'} /></div>
    case 'color':
      return <Input type="color" value={value || '#1d4ed8'} onChange={(e) => onChange(e.target.value)} className="h-10 p-1" />
    default:
      return <Input {...common} type={t === 'email' ? 'email' : t === 'tel' ? 'tel' : 'text'} value={value ?? ''}
        onChange={(e) => onChange(e.target.value)} />
  }
}
