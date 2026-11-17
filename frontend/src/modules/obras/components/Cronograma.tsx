import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BarChart3, List, Plus } from 'lucide-react'
import { Badge, Button, Card, Empty, Loading, Tabs } from '@/components/ui'
import { ResourceForm } from '@/components/resource/ResourceForm'
import type { FieldDef } from '@/components/resource/types'
import { api, type Page } from '@/core/api'
import { useAuth } from '@/core/auth'
import { data as fData } from '@/core/format'
import { Gantt, SITUACAO_SERV, type ServicoGantt } from './Gantt'

const CAMPOS: FieldDef[] = [
  { name: 'descricao', label: 'Serviço', required: true, span: 4 },
  { name: 'local', label: 'Local', span: 2 }, { name: 'etapa', label: 'Etapa', span: 2 },
  { name: 'inicio', label: 'Início', type: 'date', required: true, span: 1 }, { name: 'fim', label: 'Término', type: 'date', required: true, span: 1 },
  { name: 'percentual', label: 'Avanço atual', type: 'percent', span: 1, hint: 'Atualizado pelos diários' }, { name: 'ordem', label: 'Ordem', type: 'number', span: 1 },
  { name: 'responsavel', label: 'Responsável', span: 2 }, { name: 'codigo', label: 'Código / item', span: 2 },
  { name: 'observacoes', label: 'Observações', type: 'textarea' },
]

/** Cronograma de serviços da obra (Gantt + lista). Os diários selecionam esses serviços e atualizam o avanço. */
export function Cronograma({ obraId }: { obraId: number }) {
  const qc = useQueryClient()
  const { can } = useAuth()
  const [vista, setVista] = useState<'gantt' | 'lista'>('gantt')
  const [edit, setEdit] = useState<any | null | undefined>(undefined)
  const q = useQuery({ queryKey: ['/servicos-obra', obraId], queryFn: () => api.get<Page<ServicoGantt & Record<string, any>>>('/servicos-obra', { obra_id: obraId, page_size: 500 }) })
  const itens = q.data?.items || []
  const dur = itens.reduce((a, s) => a + (s.duracao_dias || 1), 0) || 1
  const avanco = itens.reduce((a, s) => a + Number(s.percentual) * (s.duracao_dias || 1), 0) / dur
  const recarregar = () => { qc.invalidateQueries({ queryKey: ['/servicos-obra'] }); qc.invalidateQueries({ queryKey: ['obra-resumo', obraId] }) }

  return (
    <Card title={<span className="flex items-center gap-2">Cronograma de serviços {itens.length > 0 && <Badge tone="blue">avanço {avanco.toFixed(1)}%</Badge>}</span>}
      actions={can('obras.criar') && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit(null)}>Novo serviço</Button>}>
      {q.isLoading ? <Loading /> : !itens.length ? <Empty title="Nenhum serviço no cronograma" text="Cadastre os serviços com início e término; no diário você seleciona o serviço e informa o % executado." /> : (
        <>
          <Tabs value={vista} onChange={setVista} tabs={[{ key: 'gantt', label: <span className="inline-flex items-center gap-1"><BarChart3 className="h-4 w-4" />Gantt</span> },
            { key: 'lista', label: <span className="inline-flex items-center gap-1"><List className="h-4 w-4" />Lista</span> }]} />
          <div className="pt-3">
            {vista === 'gantt' ? <Gantt servicos={itens} onSelecionar={(s) => can('obras.editar') && setEdit(s)} /> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {itens.map((s) => (
                  <li key={s.id}><button className="flex w-full items-center gap-3 py-2 text-left" onClick={() => can('obras.editar') && setEdit(s)}>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.descricao}</p>
                      <p className="text-xs text-slate-500">{fData(s.inicio)} a {fData(s.fim)}{s.local && ` · ${s.local}`}</p></div>
                    <Badge tone={SITUACAO_SERV[s.situacao]?.tom}>{SITUACAO_SERV[s.situacao]?.rot}</Badge>
                    <span className="w-12 text-right text-sm font-semibold">{Number(s.percentual).toFixed(0)}%</span>
                  </button></li>
                ))}
              </ul>
            )}
            <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
              {Object.entries(SITUACAO_SERV).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1"><Badge tone={v.tom}>{v.rot}</Badge></span>)}
              <span className="inline-flex items-center gap-1"><span className="h-3 w-0.5 bg-rose-500" />hoje</span>
            </p>
          </div>
        </>
      )}
      <ResourceForm open={edit !== undefined} onClose={() => setEdit(undefined)} endpoint="/servicos-obra" fields={CAMPOS} row={edit}
        defaults={{ obra_id: obraId, percentual: 0 }} transformOut={(b) => ({ ...b, obra_id: obraId })} size="lg"
        title={edit ? 'Editar serviço' : 'Novo serviço'} onSaved={() => { setEdit(undefined); recarregar() }} />
    </Card>
  )
}
