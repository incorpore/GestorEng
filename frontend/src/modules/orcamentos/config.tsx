import type { ResourceConfig } from '@/components/resource/types'
import { STATUS_ORCAMENTO } from '@/core/options'

export const orcamentosCfg: ResourceConfig = {
  endpoint: '/orcamentos', title: 'Orçamentos', singular: 'Orçamento', perm: 'orcamentos', canCreate: false, fields: [], attachEntity: 'orcamento',
  rowLink: (r) => `/orcamentos/${r.id}`, defaultOrder: '-data', searchPlaceholder: 'Título ou número...',
  columns: [
    { key: 'titulo', label: 'Orçamento', primary: true, render: (r) => <span><span className="font-medium">{r.titulo}</span><span className="block text-xs text-slate-400">{r.numero}</span></span> },
    { key: 'cliente_nome', label: 'Cliente', sortable: false },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'total', label: 'Total', type: 'money', align: 'right', sortable: false },
    { key: 'status', label: 'Situação', type: 'select', options: STATUS_ORCAMENTO },
  ],
  filters: [
    { name: 'status', label: 'Situação', options: STATUS_ORCAMENTO },
    { name: 'cliente_id', label: 'Cliente', type: 'relation', relation: { endpoint: '/parceiros' } },
    { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' } },
  ],
}
