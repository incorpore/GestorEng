import type { ResourceConfig } from '@/components/resource/types'
import { registrarCriacao } from '@/components/resource/criacao'

const TIPO_ITEM = [{ value: 'material', label: 'Material' }, { value: 'ferramenta', label: 'Ferramenta' }, { value: 'epi', label: 'EPI' }, { value: 'patrimonio', label: 'Patrimônio' }]
const TIPO_MOV = [{ value: 'entrada', label: 'Entrada', tone: 'green' }, { value: 'saida', label: 'Saída', tone: 'red' }, { value: 'transferencia', label: 'Transferência', tone: 'blue' }, { value: 'ajuste', label: 'Ajuste', tone: 'yellow' }]

export const itensCfg: ResourceConfig = {
  endpoint: '/itens-estoque', title: 'Itens', singular: 'Item', perm: 'inventario', attachEntity: 'item_estoque', defaultOrder: 'nome',
  fields: [
    { name: 'codigo', label: 'Código', span: 1 }, { name: 'nome', label: 'Nome', required: true, span: 3 },
    { name: 'tipo', label: 'Tipo', type: 'select', options: TIPO_ITEM, required: true, default: 'material', span: 1 },
    { name: 'categoria', label: 'Categoria', type: 'lista', lista: 'categoria_estoque', span: 1 }, { name: 'unidade', label: 'Unidade', type: 'lista', lista: 'unidade', default: 'un', required: true, span: 1 },
    { name: 'estoque_minimo', label: 'Estoque mínimo', type: 'number', span: 1 },
    { name: 'custo_medio', label: 'Custo médio', type: 'money', span: 2, hint: 'Atualizado automaticamente nas entradas' },
    { name: 'numero_patrimonio', label: 'Nº patrimônio', span: 2, hidden: (v) => v.tipo !== 'patrimonio' && v.tipo !== 'ferramenta' },
    { name: 'ativo', label: 'Ativo', type: 'boolean', default: true }, { name: 'observacoes', label: 'Observações', type: 'textarea' },
  ],
  columns: [{ key: 'nome', label: 'Item', primary: true }, { key: 'codigo', label: 'Código' }, { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_ITEM },
    { key: 'unidade', label: 'Un.' }, { key: 'estoque_minimo', label: 'Mínimo', type: 'number', align: 'right' }, { key: 'custo_medio', label: 'Custo médio', type: 'money', align: 'right' }],
  filters: [{ name: 'tipo', label: 'Tipo', options: TIPO_ITEM }],
}

export const locaisCfg: ResourceConfig = {
  endpoint: '/locais-estoque', title: 'Locais', singular: 'Local de estoque', perm: 'inventario', defaultOrder: 'nome', formSize: 'md',
  fields: [{ name: 'nome', label: 'Nome', required: true, span: 4 }, { name: 'obra_id', label: 'Obra (se almoxarifado de obra)', type: 'relation', relation: { endpoint: '/obras' }, span: 4 }, { name: 'ativo', label: 'Ativo', type: 'boolean', default: true }],
  columns: [{ key: 'nome', label: 'Local', primary: true }, { key: 'ativo', label: 'Ativo', type: 'boolean' }],
}

const loc = { endpoint: '/locais-estoque' }
export const movsCfg: ResourceConfig = {
  endpoint: '/movimentacoes', title: 'Movimentações', singular: 'Movimentação', perm: 'inventario', defaultOrder: '-data', formSize: 'md',
  fields: [
    { name: 'tipo', label: 'Tipo', type: 'select', options: TIPO_MOV, required: true, default: 'entrada', span: 2 },
    { name: 'data', label: 'Data', type: 'date', required: true, span: 2 },
    { name: 'item_id', label: 'Item', type: 'relation', relation: { endpoint: '/itens-estoque' }, required: true, span: 4 },
    { name: 'quantidade', label: 'Quantidade', type: 'number', required: true, span: 2, hint: 'Ajuste: negativo reduz' },
    { name: 'custo_unitario', label: 'Custo unitário', type: 'money', span: 2, hidden: (v) => v.tipo !== 'entrada' },
    { name: 'origem_id', label: 'Origem', type: 'relation', relation: loc, span: 2, hidden: (v) => v.tipo === 'entrada' || (v.tipo === 'ajuste' && Number(v.quantidade) >= 0) },
    { name: 'destino_id', label: 'Destino', type: 'relation', relation: loc, span: 2, hidden: (v) => v.tipo === 'saida' || (v.tipo === 'ajuste' && Number(v.quantidade) < 0) },
    { name: 'obra_id', label: 'Obra (aplicação)', type: 'relation', relation: { endpoint: '/obras' }, span: 2 },
    { name: 'funcionario_id', label: 'Retirado por', type: 'relation', relation: { endpoint: '/funcionarios' }, span: 2, hidden: (v) => v.tipo === 'entrada' },
    { name: 'fornecedor_id', label: 'Fornecedor', type: 'relation', relation: { endpoint: '/parceiros', params: { tipo: 'fornecedor' } }, span: 2, hidden: (v) => v.tipo !== 'entrada' },
    { name: 'documento', label: 'NF / requisição', span: 2 }, { name: 'observacoes', label: 'Observações', type: 'textarea' },
  ],
  columns: [{ key: 'item_nome', label: 'Item', primary: true, sortable: false }, { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_MOV }, { key: 'data', label: 'Data', type: 'date' },
    { key: 'quantidade', label: 'Qtd.', type: 'number', align: 'right' }, { key: 'origem_nome', label: 'Origem', sortable: false }, { key: 'destino_nome', label: 'Destino', sortable: false }],
  filters: [{ name: 'tipo', label: 'Tipo', options: TIPO_MOV }, { name: 'item_id', label: 'Item', type: 'relation', relation: { endpoint: '/itens-estoque' } }],
}

registrarCriacao(itensCfg)
registrarCriacao(locaisCfg)
