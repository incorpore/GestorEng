import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { Button, IconButton, Textarea } from '@/components/ui'
import { moeda, numero } from '@/core/format'

export interface GridCol {
  key: string
  label: string
  type?: 'text' | 'number' | 'money' | 'bool' | 'textarea'
  width?: string
  readOnly?: boolean
  compute?: (row: any) => number | string
  format?: 'money' | 'number' | 'percent'
}

interface Props {
  cols: GridCol[]
  rows: any[]
  onChange: (rows: any[]) => void
  newRow: () => any
  readOnly?: boolean
  rowClass?: (row: any) => string | undefined
  footer?: React.ReactNode
}

export function ItemsGrid({ cols, rows, onChange, newRow, readOnly, rowClass, footer }: Props) {
  const set = (i: number, k: string, v: any) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const move = (i: number, d: number) => {
    const n = [...rows]
    const [x] = n.splice(i, 1)
    n.splice(i + d, 0, x)
    onChange(n.map((r, j) => ({ ...r, ordem: j })))
  }
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="tbl min-w-[720px]">
          <thead><tr>{cols.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}{!readOnly && <th className="w-24" />}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={rowClass?.(r)}>
                {cols.map((c) => {
                  if (c.compute || c.readOnly || readOnly) {
                    const v = c.compute ? c.compute(r) : r[c.key]
                    const f = c.format || (c.type === 'money' ? 'money' : c.type === 'number' ? 'number' : undefined)
                    return <td key={c.key} className={clsx(f && 'text-right tabular-nums')}>
                      {f === 'money' ? moeda(v) : f === 'number' ? numero(v) : f === 'percent' ? `${numero(v, 1)}%` : c.type === 'bool' ? (v ? 'Sim' : '') : v}
                    </td>
                  }
                  if (c.type === 'bool') return <td key={c.key} className="text-center"><input type="checkbox" checked={!!r[c.key]} onChange={(e) => set(i, c.key, e.target.checked)} /></td>
                  const num = c.type === 'number' || c.type === 'money'
                  return (
                    <td key={c.key} className="p-1">
                      {c.type === 'textarea'
                        ? <Textarea variante="compacto" rows={1} value={r[c.key] ?? ''} onChange={(e) => set(i, c.key, e.target.value)} />
                        : <input className={clsx('input px-2 py-1', num && 'text-right')} type={num ? 'number' : 'text'} step="any" inputMode={num ? 'decimal' : undefined}
                          value={r[c.key] ?? ''} onChange={(e) => set(i, c.key, num ? (e.target.value === '' ? 0 : Number(e.target.value)) : e.target.value)} />}
                    </td>
                  )
                })}
                {!readOnly && (
                  <td className="whitespace-nowrap p-1">
                    <IconButton label="Subir" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                    <IconButton label="Descer" className="h-7 w-7" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
                    <IconButton label="Remover" className="h-7 w-7 hover:text-rose-600" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={cols.length + 1} className="py-6 text-center text-sm text-slate-400">Nenhum item</td></tr>}
          </tbody>
          {footer}
        </table>
      </div>
      {!readOnly && <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...rows, { ...newRow(), ordem: rows.length }])}>Adicionar item</Button>}
    </div>
  )
}
