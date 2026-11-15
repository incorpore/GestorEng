import type { Option } from '@/components/resource/types'

export const STATUS_OBRA: Option[] = [
  { value: 'planejamento', label: 'Planejamento', tone: 'gray' },
  { value: 'em_andamento', label: 'Em andamento', tone: 'blue' },
  { value: 'paralisada', label: 'Paralisada', tone: 'yellow' },
  { value: 'concluida', label: 'Concluída', tone: 'green' },
  { value: 'cancelada', label: 'Cancelada', tone: 'red' },
]
export const TIPO_OBRA: Option[] = [
  { value: 'licitacao', label: 'Pública (licitação)', tone: 'purple' },
  { value: 'particular', label: 'Particular', tone: 'blue' },
]
export const STATUS_LICITACAO: Option[] = [
  { value: 'prospeccao', label: 'Prospecção', tone: 'gray' },
  { value: 'em_analise', label: 'Em análise', tone: 'blue' },
  { value: 'documentacao', label: 'Documentação', tone: 'blue' },
  { value: 'proposta_enviada', label: 'Proposta enviada', tone: 'purple' },
  { value: 'em_disputa', label: 'Em disputa', tone: 'yellow' },
  { value: 'ganha', label: 'Ganha', tone: 'green' },
  { value: 'perdida', label: 'Perdida', tone: 'red' },
  { value: 'desistencia', label: 'Desistência', tone: 'gray' },
  { value: 'cancelada', label: 'Cancelada', tone: 'red' },
  { value: 'suspensa', label: 'Suspensa', tone: 'yellow' },
]
export const STATUS_MEDICAO: Option[] = [
  { value: 'rascunho', label: 'Rascunho', tone: 'gray' },
  { value: 'enviada', label: 'Enviada', tone: 'blue' },
  { value: 'aprovada', label: 'Aprovada', tone: 'green' },
  { value: 'faturada', label: 'Faturada', tone: 'purple' },
]
export const STATUS_ORCAMENTO: Option[] = [
  { value: 'rascunho', label: 'Rascunho', tone: 'gray' },
  { value: 'enviado', label: 'Enviado', tone: 'blue' },
  { value: 'aprovado', label: 'Aprovado', tone: 'green' },
  { value: 'recusado', label: 'Recusado', tone: 'red' },
  { value: 'cancelado', label: 'Cancelado', tone: 'gray' },
]
export const STATUS_LANC: Option[] = [
  { value: 'aberto', label: 'Em aberto', tone: 'yellow' },
  { value: 'parcial', label: 'Parcial', tone: 'blue' },
  { value: 'pago', label: 'Pago', tone: 'green' },
  { value: 'cancelado', label: 'Cancelado', tone: 'gray' },
]
export const TIPO_LANC: Option[] = [
  { value: 'receita', label: 'Receita', tone: 'green' },
  { value: 'despesa', label: 'Despesa', tone: 'red' },
]
export const VINCULO: Option[] = [
  { value: 'contratado', label: 'Contratado (CLT)', tone: 'blue' },
  { value: 'diaria', label: 'Diarista', tone: 'yellow' },
  { value: 'horista', label: 'Horista', tone: 'purple' },
  { value: 'empreita', label: 'Empreiteiro', tone: 'green' },
]
export const TIPO_VEICULO: Option[] = [
  { value: 'veiculo', label: 'Veículo' }, { value: 'maquina', label: 'Máquina' }, { value: 'equipamento', label: 'Equipamento' },
]
export const STATUS_VEICULO: Option[] = [
  { value: 'disponivel', label: 'Disponível', tone: 'green' }, { value: 'em_uso', label: 'Em uso', tone: 'blue' },
  { value: 'manutencao', label: 'Em manutenção', tone: 'yellow' }, { value: 'inativo', label: 'Inativo', tone: 'gray' },
]
export const CLIMA: Option[] = [
  { value: 'bom', label: '☀️ Bom' }, { value: 'nublado', label: '☁️ Nublado' },
  { value: 'chuvoso', label: '🌧️ Chuvoso' }, { value: 'impraticavel', label: '⛈️ Impraticável' },
]
export const TIPO_PARCEIRO: Option[] = [
  { value: 'cliente', label: 'Cliente', tone: 'blue' }, { value: 'fornecedor', label: 'Fornecedor', tone: 'purple' },
  { value: 'orgao', label: 'Órgão público', tone: 'green' }, { value: 'prestador', label: 'Prestador', tone: 'yellow' },
]
export const TIPO_DOC: Option[] = [
  { value: 'oficio', label: 'Ofício' }, { value: 'boletim_medicao', label: 'Boletim de medição' },
  { value: 'recibo', label: 'Recibo' }, { value: 'declaracao', label: 'Declaração' }, { value: 'contrato', label: 'Contrato' },
  { value: 'relatorio', label: 'Relatório' }, { value: 'memorando', label: 'Memorando' }, { value: 'proposta', label: 'Proposta' },
  { value: 'ata', label: 'Ata' }, { value: 'notificacao', label: 'Notificação' }, { value: 'outro', label: 'Outro' },
]
export const STATUS_DOC: Option[] = [
  { value: 'rascunho', label: 'Rascunho', tone: 'gray' }, { value: 'emitido', label: 'Emitido', tone: 'blue' },
  { value: 'aguardando_assinatura', label: 'Aguardando assinatura', tone: 'yellow' },
  { value: 'assinado', label: 'Assinado', tone: 'green' }, { value: 'assinatura_recusada', label: 'Assinatura recusada', tone: 'red' },
  { value: 'cancelado', label: 'Cancelado', tone: 'red' },
]
export const label = (opts: Option[], v: unknown) => opts.find((o) => String(o.value) === String(v))?.label ?? String(v ?? '—')
