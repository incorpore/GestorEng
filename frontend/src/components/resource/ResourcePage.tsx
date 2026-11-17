import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Filter, Paperclip, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, Empty, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, Select, useConfirm } from '@/components/ui'
import { api, type Page } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errMsg, useToast } from '@/core/toast'
import { Attachments } from './Attachments'
import { renderCell } from './cells'
import { RelationSelect } from './RelationSelect'
import { ResourceForm } from './ResourceForm'
import type { ResourceConfig } from './types'

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

export function ResourceList<T extends { id: number }>({ cfg, embedded = false, hideHeader = false }: { cfg: ResourceConfig<T>; embedded?: boolean; hideHeader?: boolean }) {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [order, setOrder] = useState<string | undefined>(cfg.defaultOrder)
  const [filters, setFilters] = useState<Record<string, any>>(() => {
    const f: Record<string, any> = {}
    cfg.filters?.forEach((x) => { const v = sp.get(x.name); if (v) f[x.name] = v })
    return f
  })
  const [showFilters, setShowFilters] = useState(false)
  const [editing, setEditing] = useState<T | null | undefined>(undefined)
  const [attach, setAttach] = useState<T | null>(null)
  const dq = useDebounced(q)
  const pageSize = 25
  const params = { q: dq, page, page_size: pageSize, order, ...cfg.baseParams, ...filters }
  const key = [cfg.endpoint, params]
  const { data, isLoading, isFetching } = useQuery({ queryKey: key, queryFn: () => api.get<Page<T>>(cfg.endpoint, params), placeholderData: keepPreviousData })
  useEffect(() => setPage(1), [dq, filters])

  const reload = () => qc.invalidateQueries({ queryKey: [cfg.endpoint] })
  const canCreate = cfg.canCreate !== false && can(`${cfg.perm}.criar`)
  const canEdit = can(`${cfg.perm}.editar`)
  const canDelete = can(`${cfg.perm}.excluir`)
  const activeFilters = Object.values(filters).filter((v) => v !== '' && v != null).length

  async function remove(row: T) {
    if (!(await confirm(`Excluir este registro de ${cfg.singular.toLowerCase()}? Esta ação não pode ser desfeita.`, { danger: true, ok: 'Excluir' }))) return
    try { await api.del(`${cfg.endpoint}/${row.id}`); toast('Registro excluído'); reload() } catch (e) { toast(errMsg(e), 'error') }
  }

  const primaryCol = useMemo(() => cfg.columns.find((c) => c.primary) || cfg.columns[0], [cfg.columns])
  const onRow = (row: T) => (cfg.rowLink ? nav(cfg.rowLink(row)) : canEdit ? setEditing(row) : undefined)

  const sortBy = (k: string) => setOrder((o) => (o === k ? `-${k}` : k))

  return (
    <div>
      {!hideHeader && (
        <PageHeader title={embedded ? undefined : cfg.title} actions={<>
          {cfg.headerActions}
          {canCreate && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Novo</Button>}
        </>} />
      )}
      <Card padded={false}>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 dark:border-slate-800 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder={cfg.searchPlaceholder || 'Buscar...'} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {cfg.filters?.length ? (
              <Button variant="secondary" icon={<Filter className="h-4 w-4" />} onClick={() => setShowFilters((s) => !s)}>
                Filtros{activeFilters ? ` (${activeFilters})` : ''}
              </Button>
            ) : null}
            {hideHeader && canCreate && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Novo</Button>}
          </div>
        </div>
        {showFilters && cfg.filters && (
          <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/20 sm:grid-cols-4">
            {cfg.filters.map((f) => (
              <Field key={f.name} label={f.label}>
                {f.type === 'relation' ? (
                  <RelationSelect semCriar endpoint={f.relation!.endpoint} labelKey={f.relation!.labelKey} value={filters[f.name] ? Number(filters[f.name]) : null}
                    onChange={(v) => setFilters((s) => ({ ...s, [f.name]: v ?? '' }))} placeholder="Todos" />
                ) : f.type === 'date' ? (
                  <Input type="date" value={filters[f.name] || ''} onChange={(e) => setFilters((s) => ({ ...s, [f.name]: e.target.value }))} />
                ) : (
                  <Select value={filters[f.name] ?? ''} onChange={(e) => setFilters((s) => ({ ...s, [f.name]: e.target.value }))}>
                    <option value="">Todos</option>
                    {(f.type === 'boolean' ? [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }] : f.options)?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                )}
              </Field>
            ))}
            <div className="flex items-end"><Button variant="ghost" onClick={() => setFilters({})}>Limpar filtros</Button></div>
          </div>
        )}
        {isLoading ? <Loading /> : !data?.items.length ? (
          <Empty title="Nenhum registro encontrado" text={q || activeFilters ? 'Ajuste a busca ou os filtros.' : `Cadastre o primeiro registro de ${cfg.singular.toLowerCase()}.`}
            action={canCreate && !q ? <Button size="sm" onClick={() => setEditing(null)} icon={<Plus className="h-4 w-4" />}>Novo</Button> : undefined} />
        ) : (
          <>
            {/* Tabela (desktop) */}
            <div className={clsx('hidden overflow-x-auto md:block', isFetching && 'opacity-70')}>
              <table className="tbl">
                <thead>
                  <tr>
                    {cfg.columns.map((c) => (
                      <th key={c.key} className={clsx(c.align === 'right' && 'text-right', c.sortable !== false && 'cursor-pointer select-none')}
                        onClick={() => c.sortable !== false && !c.key.includes('.') && !c.render && sortBy(c.key)}>
                        <span className="inline-flex items-center gap-1">{c.label}
                          {order === c.key && <ArrowUp className="h-3 w-3" />}{order === `-${c.key}` && <ArrowDown className="h-3 w-3" />}
                        </span>
                      </th>
                    ))}
                    <th className="w-px" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id} className="cursor-pointer" onClick={() => onRow(row)}>
                      {cfg.columns.map((c) => (
                        <td key={c.key} className={clsx(c.align === 'right' && 'text-right tabular-nums', c.className)}>{renderCell(c, row)}</td>
                      ))}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          {cfg.rowActions?.(row, reload)}
                          {cfg.attachEntity && <IconButton label="Anexos" onClick={() => setAttach(row)}><Paperclip className="h-4 w-4" /></IconButton>}
                          {canEdit && cfg.rowLink && <IconButton label="Editar" onClick={() => setEditing(row)}><Pencil className="h-4 w-4" /></IconButton>}
                          {canDelete && <IconButton label="Excluir" className="hover:text-rose-600" onClick={() => remove(row)}><Trash2 className="h-4 w-4" /></IconButton>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Cards (mobile) */}
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {data.items.map((row) => (
                <li key={row.id} className="p-3 active:bg-slate-50 dark:active:bg-slate-800" onClick={() => onRow(row)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{renderCell(primaryCol, row)}</p>
                    <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {cfg.rowActions?.(row, reload)}
                      {cfg.attachEntity && <IconButton label="Anexos" className="h-8 w-8" onClick={() => setAttach(row)}><Paperclip className="h-4 w-4" /></IconButton>}
                      {canEdit && cfg.rowLink && <IconButton label="Editar" className="h-8 w-8" onClick={() => setEditing(row)}><Pencil className="h-4 w-4" /></IconButton>}
                    </div>
                  </div>
                  <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {cfg.columns.filter((c) => c !== primaryCol && !c.hideMobile).map((c) => (
                      <div key={c.key} className="min-w-0">
                        <dt className="text-slate-400">{c.label}</dt>
                        <dd className="truncate text-slate-700 dark:text-slate-300">{renderCell(c, row)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
            <div className="px-3"><Pagination page={page} pageSize={pageSize} total={data.total} onChange={setPage} /></div>
          </>
        )}
      </Card>

      <ResourceForm open={editing !== undefined} onClose={() => setEditing(undefined)} endpoint={cfg.endpoint} fields={cfg.fields}
        row={editing} size={cfg.formSize} extra={cfg.extraForm} transformOut={cfg.transformOut}
        defaults={cfg.baseParams}
        title={editing ? `Editar ${cfg.singular.toLowerCase()}` : `Novo(a) ${cfg.singular.toLowerCase()}`}
        onSaved={() => { setEditing(undefined); reload() }} />

      {attach && cfg.attachEntity && (
        <Modal open onClose={() => setAttach(null)} title="Anexos" size="lg">
          <Attachments entidade={cfg.attachEntity} entidadeId={attach.id} canEdit={canEdit} />
        </Modal>
      )}
    </div>
  )
}

export const ResourcePage = ResourceList
