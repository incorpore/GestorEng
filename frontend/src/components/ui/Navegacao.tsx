import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { IconButton } from './Botoes'

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode; hidden?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 dark:border-slate-800">
      {tabs.filter((t) => !t.hidden).map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={clsx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition',
            value === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: () => void }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {back && <IconButton label="Voltar" onClick={back}><ChevronLeft className="h-5 w-5" /></IconButton>}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return <p className="px-1 py-3 text-xs text-slate-400">{total} registro(s)</p>
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm">
      <span className="text-xs text-slate-500">{total} registros · página {page} de {pages}</span>
      <div className="flex gap-1">
        <IconButton label="Anterior" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /></IconButton>
        <IconButton label="Próxima" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight className="h-4 w-4" /></IconButton>
      </div>
    </div>
  )
}
