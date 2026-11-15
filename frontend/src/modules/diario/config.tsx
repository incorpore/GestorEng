import type { ResourceConfig } from '@/components/resource/types'
import { CLIMA } from '@/core/options'

export const STATUS_DIARIO = [{ value: 'aberto', label: 'Aberto', tone: 'yellow' }, { value: 'fechado', label: 'Fechado', tone: 'green' }]

export const diariosCfg: ResourceConfig = {
  endpoint: '/diarios', title: 'Diário de obras', singular: 'Diário', perm: 'diario', defaultOrder: '-data',
  rowLink: (r) => `/diario/${r.id}`, canCreate: false, fields: [],
  columns: [
    { key: 'data', label: 'Data', type: 'date', primary: true, render: (r) => <span className="font-medium">{new Date(r.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</span> },
    { key: 'numero', label: 'Nº' },
    { key: 'obra_nome', label: 'Obra', sortable: false },
    { key: 'clima_manha', label: 'Manhã', type: 'select', options: CLIMA, hideMobile: true },
    { key: 'clima_tarde', label: 'Tarde', type: 'select', options: CLIMA, hideMobile: true },
    { key: 'total_efetivo', label: 'Efetivo', sortable: false },
    { key: 'status', label: 'Situação', type: 'select', options: STATUS_DIARIO },
  ],
  filters: [
    { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' } },
    { name: 'status', label: 'Situação', options: STATUS_DIARIO },
    { name: 'data', label: 'Data', type: 'date' },
  ],
}
