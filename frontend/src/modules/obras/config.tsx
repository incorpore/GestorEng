import type { ResourceConfig } from '@/components/resource/types'
import { Badge } from '@/components/ui'
import { STATUS_MEDICAO, STATUS_OBRA, TIPO_OBRA } from '@/core/options'

export const obrasCfg: ResourceConfig = {
  endpoint: '/obras', title: 'Obras', singular: 'Obra', perm: 'obras', attachEntity: 'obra', formSize: 'xl',
  searchPlaceholder: 'Nome, código, contrato, cidade...', rowLink: (r) => `/obras/${r.id}`, defaultOrder: '-id',
  fields: [
    { name: 'codigo', label: 'Código', span: 1, section: 'Identificação' },
    { name: 'nome', label: 'Nome da obra', required: true, span: 3 },
    { name: 'tipo', label: 'Tipo', type: 'select', options: TIPO_OBRA, required: true, default: 'particular', span: 1 },
    { name: 'status', label: 'Situação', type: 'select', options: STATUS_OBRA, required: true, default: 'planejamento', span: 1 },
    { name: 'cliente_id', label: 'Contratante', type: 'relation', relation: { endpoint: '/parceiros' }, span: 2 },
    { name: 'licitacao_id', label: 'Licitação de origem', type: 'relation', relation: { endpoint: '/licitacoes', labelKey: 'objeto' }, span: 2, hidden: (v) => v.tipo !== 'licitacao' },
    { name: 'numero_contrato', label: 'Nº do contrato', span: 2 },
    { name: 'objeto', label: 'Objeto', type: 'textarea' },
    { name: 'valor_contrato', label: 'Valor do contrato', type: 'money', span: 1, section: 'Contrato e prazos' },
    { name: 'valor_aditivos', label: 'Aditivos', type: 'money', span: 1 },
    { name: 'data_assinatura', label: 'Assinatura', type: 'date', span: 1 },
    { name: 'data_inicio', label: 'Início (OS)', type: 'date', span: 1 },
    { name: 'prazo_dias', label: 'Prazo (dias)', type: 'number', span: 1 },
    { name: 'data_prevista_fim', label: 'Término previsto', type: 'date', span: 1, hint: 'Calculado se vazio' },
    { name: 'data_conclusao', label: 'Conclusão', type: 'date', span: 1 },
    { name: 'progresso', label: 'Avanço físico', type: 'percent', span: 1 },
    { name: 'endereco', label: 'Endereço', span: 2, section: 'Localização' },
    { name: 'cidade', label: 'Cidade', span: 1 },
    { name: 'uf', label: 'UF', type: 'uf', span: 1 },
    { name: 'latitude', label: 'Latitude', span: 1 },
    { name: 'longitude', label: 'Longitude', span: 1 },
    { name: 'responsavel_tecnico', label: 'Responsável técnico', span: 2, section: 'Responsabilidade técnica' },
    { name: 'crea_cau', label: 'CREA/CAU', span: 1 },
    { name: 'art_rrt', label: 'ART/RRT', span: 1 },
    { name: 'fiscal_contrato', label: 'Fiscal do contrato', span: 2 },
    { name: 'observacoes', label: 'Observações', type: 'textarea' },
  ],
  columns: [
    { key: 'nome', label: 'Obra', primary: true, render: (r) => <span><span className="font-medium">{r.nome}</span>{r.codigo && <span className="ml-1 text-xs text-slate-400">#{r.codigo}</span>}</span> },
    { key: 'cliente_nome', label: 'Contratante', sortable: false },
    { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_OBRA, hideMobile: true },
    { key: 'status', label: 'Situação', type: 'select', options: STATUS_OBRA },
    { key: 'valor_contrato', label: 'Valor', type: 'money', align: 'right' },
    { key: 'progresso', label: 'Avanço', render: (r) => <Progress v={r.progresso} /> },
    { key: 'data_prevista_fim', label: 'Término', type: 'date', hideMobile: true },
  ],
  filters: [
    { name: 'status', label: 'Situação', options: STATUS_OBRA },
    { name: 'tipo', label: 'Tipo', options: TIPO_OBRA },
    { name: 'cliente_id', label: 'Contratante', type: 'relation', relation: { endpoint: '/parceiros' } },
  ],
}

export function Progress({ v }: { v: number }) {
  const p = Math.max(0, Math.min(100, Number(v || 0)))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} /></div>
      <span className="text-xs tabular-nums text-slate-500">{p.toFixed(0)}%</span>
    </div>
  )
}

export const medicaoStatus = (s: string) => {
  const o = STATUS_MEDICAO.find((x) => x.value === s)
  return <Badge tone={o?.tone}>{o?.label || s}</Badge>
}
