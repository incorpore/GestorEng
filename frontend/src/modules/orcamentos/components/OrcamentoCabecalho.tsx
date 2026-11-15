import { Card } from '@/components/ui'
import { FormGrid } from '@/components/resource/ResourceForm'
import type { FieldDef } from '@/components/resource/types'
import { STATUS_ORCAMENTO } from '@/core/options'

export const CAMPOS: FieldDef[] = [
  { name: 'titulo', label: 'Título / objeto', required: true, span: 3 },
  { name: 'status', label: 'Situação', type: 'select', options: STATUS_ORCAMENTO, required: true, span: 1 },
  { name: 'cliente_id', label: 'Cliente', type: 'relation', relation: { endpoint: '/parceiros' }, span: 2 },
  { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' }, span: 1 },
  { name: 'licitacao_id', label: 'Licitação', type: 'relation', relation: { endpoint: '/licitacoes', labelKey: 'objeto' }, span: 1 },
  { name: 'data', label: 'Data', type: 'date', required: true, span: 1 },
  { name: 'validade', label: 'Validade', type: 'date', span: 1 },
  { name: 'referencia', label: 'Referência de preços', placeholder: 'SINAPI 10/2026 SP não desonerado', span: 2 },
  { name: 'bdi', label: 'BDI', type: 'percent', span: 1 },
  { name: 'desconto', label: 'Desconto', type: 'percent', span: 1 },
  { name: 'condicoes', label: 'Condições comerciais', type: 'textarea', span: 2 },
  { name: 'observacoes', label: 'Observações', type: 'textarea', span: 2 },
]

export function OrcamentoCabecalho({ v, set }: { v: any; set: (k: string, x: any) => void }) {
  return <Card><FormGrid fields={CAMPOS} values={v} set={set} /></Card>
}
