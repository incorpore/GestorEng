import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button, Card, Empty, Loading, Modal, PageHeader, Pagination, useConfirm } from '@/components/ui'
import { api, type Page } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errMsg, useToast } from '@/core/toast'
import { Attachments } from './Attachments'
import { BarraBusca } from './lista/BarraBusca'
import { CartoesRegistros } from './lista/CartoesRegistros'
import { PainelFiltros } from './lista/PainelFiltros'
import { TabelaRegistros } from './lista/TabelaRegistros'
import { useDebounced } from './lista/useDebounced'
import { ResourceForm } from './ResourceForm'
import type { ResourceConfig } from './types'

const POR_PAGINA = 25

/** Listagem padrão de qualquer cadastro: busca, filtros, tabela/cartões, paginação, formulário e anexos. */
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
  const params = { q: dq, page, page_size: POR_PAGINA, order, ...cfg.baseParams, ...filters }
  const { data, isLoading, isFetching } = useQuery({ queryKey: [cfg.endpoint, params], queryFn: () => api.get<Page<T>>(cfg.endpoint, params), placeholderData: keepPreviousData })
  useEffect(() => setPage(1), [dq, filters])

  const reload = () => qc.invalidateQueries({ queryKey: [cfg.endpoint] })
  const canCreate = cfg.canCreate !== false && can(`${cfg.perm}.criar`)
  const canEdit = can(`${cfg.perm}.editar`)
  const canDelete = can(`${cfg.perm}.excluir`)
  const ativos = Object.values(filters).filter((v) => v !== '' && v != null).length
  const principal = useMemo(() => cfg.columns.find((c) => c.primary) || cfg.columns[0], [cfg.columns])
  const onLinha = (row: T) => (cfg.rowLink ? nav(cfg.rowLink(row)) : canEdit ? setEditing(row) : undefined)

  async function remove(row: T) {
    if (!(await confirm(`Excluir este registro de ${cfg.singular.toLowerCase()}? Esta ação não pode ser desfeita.`, { title: 'Excluir registro', danger: true, ok: 'Excluir' }))) return
    try { await api.del(`${cfg.endpoint}/${row.id}`); toast('Registro excluído'); reload() } catch (e) { toast(errMsg(e), 'error') }
  }

  const acoes = {
    extras: cfg.rowActions ? (row: T) => cfg.rowActions!(row, reload) : undefined,
    anexos: cfg.attachEntity ? setAttach : undefined,
    editar: canEdit && cfg.rowLink ? (row: T) => setEditing(row) : undefined,
    excluir: canDelete ? remove : undefined,
  }
  const novo = () => setEditing(null)

  return (
    <div>
      {!hideHeader && (
        <PageHeader title={embedded ? undefined : cfg.title} actions={<>
          {cfg.headerActions}
          {canCreate && <Button icon={<Plus className="h-4 w-4" />} onClick={novo}>Novo</Button>}
        </>} />
      )}
      <Card padded={false}>
        <BarraBusca q={q} onQ={setQ} placeholder={cfg.searchPlaceholder} temFiltros={!!cfg.filters?.length} ativos={ativos}
          onFiltros={() => setShowFilters((s) => !s)} onNovo={hideHeader && canCreate ? novo : undefined} />
        {showFilters && cfg.filters && <PainelFiltros filtros={cfg.filters} valores={filters} onChange={setFilters} />}
        {isLoading ? <Loading /> : !data?.items.length ? (
          <Empty title="Nenhum registro encontrado" text={q || ativos ? 'Ajuste a busca ou os filtros.' : `Cadastre o primeiro registro de ${cfg.singular.toLowerCase()}.`}
            action={canCreate && !q ? <Button size="sm" onClick={novo} icon={<Plus className="h-4 w-4" />}>Novo</Button> : undefined} />
        ) : (
          <>
            <TabelaRegistros itens={data.items} colunas={cfg.columns} ordem={order} onOrdenar={(k) => setOrder((o) => (o === k ? `-${k}` : k))}
              onLinha={onLinha} acoes={acoes} carregando={isFetching} />
            <CartoesRegistros itens={data.items} colunas={cfg.columns} principal={principal} onLinha={onLinha} acoes={acoes} />
            <div className="px-3"><Pagination page={page} pageSize={POR_PAGINA} total={data.total} onChange={setPage} /></div>
          </>
        )}
      </Card>

      <ResourceForm open={editing !== undefined} onClose={() => setEditing(undefined)} endpoint={cfg.endpoint} fields={cfg.fields}
        row={editing} size={cfg.formSize} extra={cfg.extraForm} transformOut={cfg.transformOut} defaults={cfg.baseParams}
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
