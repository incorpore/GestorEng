import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { api, type Page } from '@/core/api'

interface Props {
  endpoint: string
  value: number | null | undefined
  onChange: (v: number | null, row?: any) => void
  labelKey?: string
  params?: Record<string, unknown>
  placeholder?: string
  disabled?: boolean
}

export function RelationSelect({ endpoint, value, onChange, labelKey = 'nome', params, placeholder = 'Selecione...', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const label = (r: any) => r?.[labelKey] ?? r?.nome ?? r?.titulo ?? r?.descricao ?? `#${r?.id}`

  const list = useQuery({
    queryKey: [endpoint, 'opts', q, params],
    queryFn: () => api.get<Page<any>>(endpoint, { q, page_size: 30, ...params }),
    enabled: open,
  })
  const current = useQuery({
    queryKey: [endpoint, value],
    queryFn: () => api.get(`${endpoint}/${value}`),
    enabled: !!value,
    staleTime: 60_000,
  })

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const items = useMemo(() => list.data?.items || [], [list.data])

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between text-left">
        <span className={value ? '' : 'text-slate-400'}>{value ? (current.data ? label(current.data) : '...') : placeholder}</span>
        <span className="flex items-center gap-1">
          {value && !disabled && <X className="h-4 w-4 text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); onChange(null) }} />}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <input autoFocus className="input rounded-b-none border-0 border-b" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="max-h-60 overflow-y-auto py-1 text-sm">
            {list.isLoading && <li className="px-3 py-2 text-slate-400">Carregando...</li>}
            {!list.isLoading && items.length === 0 && <li className="px-3 py-2 text-slate-400">Nenhum resultado</li>}
            {items.map((r) => (
              <li key={r.id}>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => { onChange(r.id, r); setOpen(false) }}>{label(r)}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
