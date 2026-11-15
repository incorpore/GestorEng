import type { ResourceConfig } from '@/components/resource/types'
import { STATUS_VEICULO, TIPO_VEICULO } from '@/core/options'

export const veiculosCfg: ResourceConfig = {
  endpoint: '/veiculos', title: 'Veículos e equipamentos', singular: 'Veículo/equipamento', perm: 'frota', attachEntity: 'veiculo', defaultOrder: 'identificacao',
  searchPlaceholder: 'Placa, patrimônio, modelo...', formSize: 'xl',
  fields: [
    { name: 'tipo', label: 'Tipo', type: 'select', options: TIPO_VEICULO, required: true, default: 'veiculo', span: 1 },
    { name: 'identificacao', label: 'Placa / patrimônio', required: true, span: 1 },
    { name: 'descricao', label: 'Descrição', required: true, span: 2 },
    { name: 'marca', label: 'Marca', span: 1 }, { name: 'modelo', label: 'Modelo', span: 1 }, { name: 'ano', label: 'Ano', type: 'number', span: 1 },
    { name: 'combustivel', label: 'Combustível', type: 'select', options: ['Diesel', 'Gasolina', 'Etanol', 'Flex', 'Elétrico', 'GNV'].map((x) => ({ value: x, label: x })), span: 1 },
    { name: 'renavam', label: 'RENAVAM', span: 2 }, { name: 'chassi', label: 'Chassi / nº série', span: 2 },
    { name: 'medidor', label: 'Medidor', type: 'select', options: [{ value: 'km', label: 'Quilometragem' }, { value: 'horas', label: 'Horímetro' }], default: 'km', span: 1, section: 'Operação' },
    { name: 'leitura_atual', label: 'Leitura atual', type: 'number', span: 1 },
    { name: 'proxima_revisao_leitura', label: 'Próxima revisão em', type: 'number', span: 1 },
    { name: 'status', label: 'Situação', type: 'select', options: STATUS_VEICULO, default: 'disponivel', required: true, span: 1 },
    { name: 'obra_id', label: 'Obra alocada', type: 'relation', relation: { endpoint: '/obras' }, span: 2 },
    { name: 'responsavel_id', label: 'Responsável', type: 'relation', relation: { endpoint: '/funcionarios' }, span: 2 },
    { name: 'proprio', label: 'Próprio', type: 'boolean', default: true, span: 1 },
    { name: 'valor_locacao', label: 'Locação mensal', type: 'money', span: 1, hidden: (v) => v.proprio },
    { name: 'vencimento_licenciamento', label: 'Vencimento licenciamento', type: 'date', span: 1 },
    { name: 'vencimento_seguro', label: 'Vencimento seguro', type: 'date', span: 1 },
    { name: 'observacoes', label: 'Observações', type: 'textarea' },
  ],
  columns: [
    { key: 'identificacao', label: 'Placa/Patr.', primary: true, render: (r) => <span><span className="font-mono font-semibold">{r.identificacao}</span> <span className="text-slate-500">{r.descricao}</span></span> },
    { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_VEICULO },
    { key: 'status', label: 'Situação', type: 'select', options: STATUS_VEICULO },
    { key: 'obra_nome', label: 'Obra', sortable: false },
    { key: 'leitura_atual', label: 'Leitura', render: (r) => `${Number(r.leitura_atual).toLocaleString('pt-BR')} ${r.medidor}` },
    { key: 'vencimento_licenciamento', label: 'Licenciamento', type: 'date', hideMobile: true },
  ],
  filters: [{ name: 'tipo', label: 'Tipo', options: TIPO_VEICULO }, { name: 'status', label: 'Situação', options: STATUS_VEICULO },
    { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' } }],
}

const veic = { endpoint: '/veiculos', labelKey: 'identificacao' }
export const manutencoesCfg: ResourceConfig = {
  endpoint: '/manutencoes', title: 'Manutenções', singular: 'Manutenção', perm: 'frota', attachEntity: 'manutencao', defaultOrder: '-data',
  fields: [
    { name: 'veiculo_id', label: 'Veículo / equipamento', type: 'relation', relation: veic, required: true, span: 2 },
    { name: 'tipo', label: 'Tipo', type: 'select', required: true, default: 'preventiva', options: [{ value: 'preventiva', label: 'Preventiva' }, { value: 'corretiva', label: 'Corretiva' }, { value: 'revisao', label: 'Revisão' }], span: 1 },
    { name: 'status', label: 'Situação', type: 'select', required: true, default: 'concluida', options: [{ value: 'agendada', label: 'Agendada' }, { value: 'em_execucao', label: 'Em execução' }, { value: 'concluida', label: 'Concluída' }], span: 1 },
    { name: 'data', label: 'Data', type: 'date', required: true, span: 1 }, { name: 'leitura', label: 'Km / horas', type: 'number', span: 1 },
    { name: 'custo', label: 'Custo', type: 'money', span: 1 },
    { name: 'fornecedor_id', label: 'Oficina / fornecedor', type: 'relation', relation: { endpoint: '/parceiros' }, span: 1 },
    { name: 'descricao', label: 'Serviços executados', type: 'textarea', required: true },
  ],
  columns: [
    { key: 'veiculo_nome', label: 'Veículo', primary: true, sortable: false }, { key: 'data', label: 'Data', type: 'date' },
    { key: 'tipo', label: 'Tipo' }, { key: 'descricao', label: 'Descrição', hideMobile: true, render: (r) => <span className="line-clamp-1 max-w-md">{r.descricao}</span> },
    { key: 'custo', label: 'Custo', type: 'money', align: 'right' }, { key: 'status', label: 'Situação' },
  ],
  filters: [{ name: 'veiculo_id', label: 'Veículo', type: 'relation', relation: veic }],
}

export const abastecimentosCfg: ResourceConfig = {
  endpoint: '/abastecimentos', title: 'Abastecimentos', singular: 'Abastecimento', perm: 'frota', defaultOrder: '-data', formSize: 'md',
  fields: [
    { name: 'veiculo_id', label: 'Veículo / equipamento', type: 'relation', relation: veic, required: true, span: 4 },
    { name: 'data', label: 'Data', type: 'date', required: true, span: 2 }, { name: 'leitura', label: 'Km / horas', type: 'number', span: 2 },
    { name: 'litros', label: 'Litros', type: 'number', required: true, span: 2 }, { name: 'valor_total', label: 'Valor total', type: 'money', required: true, span: 2 },
    { name: 'obra_id', label: 'Obra (centro de custo)', type: 'relation', relation: { endpoint: '/obras' }, span: 4 },
    { name: 'posto', label: 'Posto', span: 2 }, { name: 'motorista', label: 'Motorista/operador', span: 2 },
  ],
  columns: [
    { key: 'veiculo_nome', label: 'Veículo', primary: true, sortable: false }, { key: 'data', label: 'Data', type: 'date' },
    { key: 'litros', label: 'Litros', type: 'number', align: 'right' }, { key: 'valor_total', label: 'Valor', type: 'money', align: 'right' },
    { key: 'preco_litro', label: 'R$/L', align: 'right', sortable: false, render: (r) => Number(r.preco_litro).toFixed(3) }, { key: 'leitura', label: 'Leitura', type: 'number', hideMobile: true },
  ],
  filters: [{ name: 'veiculo_id', label: 'Veículo', type: 'relation', relation: veic }, { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' } }],
}
