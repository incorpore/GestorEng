import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import { api, type Page } from '@/core/api'
import { useAuth } from '@/core/auth'
import { criacaoPara } from './criacao'
import { ResourceForm } from './ResourceForm'

interface Props {
  endpoint: string
  value: number | null | undefined
  onChange: (v: number | null, row?: any) => void
  labelKey?: string
  params?: Record<string, unknown>
  placeholder?: string
  disabled?: boolean
  /** em filtros: não oferece cadastrar novo */
  semCriar?: boolean
}

export function RelationSelect({ endpoint, value, onChange, labelKey = 'nome', params, placeholder = 'Selecione...', disabled, semCriar }: Props) {
  const qc = useQueryClient()
  const { can } = useAuth()
  const criacao = semCriar ? undefined : criacaoPara(endpoint)
  const podeCriar = !!criacao && !disabled && can(`${criacao.perm}.criar`)
  const [novo, setNovo] = useState<Record<string, any> | null>(null)
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

  // abre o cadastro em pop-up já com o texto buscado e os filtros da lista (ex.: tipo = órgão, obra atual)
  function abrirNovo() {
    const campos = new Set(criacao!.fields.map((f) => f.name))
    const pre: Record<string, any> = {}
    Object.entries(params || {}).forEach(([k, v]) => { if (!k.includes('__') && campos.has(k)) pre[k] = v })
    const principal = criacao!.labelKey || (campos.has(labelKey) ? labelKey : criacao!.fields.find((f) => f.required && (!f.type || f.type === 'text'))?.name)
    if (principal && q) pre[principal] = q
    setOpen(false)
    setNovo(pre)
  }
  const extras = Object.fromEntries(Object.entries(params || {}).filter(([k]) => !k.includes('__') && !(criacao?.fields || []).some((f) => f.name === k)))

  return (
    <div ref={ref} className="relative flex gap-1">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className="input flex min-w-0 flex-1 items-center justify-between text-left">
        <span className={value ? '' : 'text-slate-400'}>{value ? (current.data ? label(current.data) : '...') : placeholder}</span>
        <span className="flex items-center gap-1">
          {value && !disabled && <X className="h-4 w-4 text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); onChange(null) }} />}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </span>
      </button>
      {podeCriar && (
        <button type="button" title={`Cadastrar ${criacao!.singular.toLowerCase()}`} aria-label={`Cadastrar ${criacao!.singular.toLowerCase()}`} onClick={abrirNovo}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-primary hover:bg-primary-50 dark:border-slate-700">
          <Plus className="h-4 w-4" />
        </button>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <input autoFocus className="input rounded-b-none border-0 border-b" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="max-h-60 overflow-y-auto py-1 text-sm">
            {list.isLoading && <li className="px-3 py-2 text-slate-400">Carregando...</li>}
            {!list.isLoading && items.length === 0 && <li className="px-3 py-2 text-slate-400">Nenhum resultado</li>}
            {podeCriar && (
              <li><button type="button" onClick={abrirNovo} className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left font-medium text-primary hover:bg-primary-50 dark:border-slate-800">
                <Plus className="h-4 w-4" />Cadastrar {q ? `"${q}"` : `novo(a) ${criacao!.singular.toLowerCase()}`}</button></li>
            )}
            {items.map((r) => (
              <li key={r.id}>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => { onChange(r.id, r); setOpen(false) }}>{label(r)}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {novo && criacao && (
        <ResourceForm open onClose={() => setNovo(null)} endpoint={criacao.endpoint} fields={criacao.fields} row={null} defaults={novo}
          transformOut={(b) => ({ ...extras, ...b })} size="lg" title={`Cadastrar ${criacao.singular.toLowerCase()}`}
          onSaved={(r) => { setNovo(null); qc.invalidateQueries({ queryKey: [endpoint] }); qc.setQueryData([endpoint, r.id], r); onChange(r.id, r) }} />
      )}
    </div>
  )
}
