import { Badge } from '@/components/ui'
import { data, dataHora, moeda, numero } from '@/core/format'
import type { ColumnDef, Option } from './types'

export function optionLabel(options: Option[] | undefined, v: unknown) {
  return options?.find((o) => String(o.value) === String(v))
}

export function renderCell(c: ColumnDef, row: any) {
  if (c.render) return c.render(row)
  const v = c.key.split('.').reduce((o, k) => (o == null ? o : o[k]), row)
  switch (c.type) {
    case 'money': return moeda(v)
    case 'number': return numero(v)
    case 'percent': return v == null ? '—' : `${numero(v, 1)}%`
    case 'date': return data(v)
    case 'datetime': return dataHora(v)
    case 'boolean': return v ? <Badge tone="green">Sim</Badge> : <Badge>Não</Badge>
    case 'select': {
      const o = optionLabel(c.options, v)
      return o ? <Badge tone={o.tone}>{o.label}</Badge> : v ?? '—'
    }
    default: return v === null || v === undefined || v === '' ? '—' : String(v)
  }
}
