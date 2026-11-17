import type { ResourceConfig } from '@/components/resource/types'
import { Badge } from '@/components/ui'
import { moeda } from '@/core/format'
import { STATUS_LANC, TIPO_LANC } from '@/core/options'
import { BaixarButton } from './Baixar'
import { registrarCriacao } from '@/components/resource/criacao'


export const lancamentosCfg: ResourceConfig = {
  endpoint: '/lancamentos', title: 'Lançamentos', singular: 'Lançamento', perm: 'financeiro', attachEntity: 'lancamento',
  defaultOrder: 'vencimento', searchPlaceholder: 'Descrição, documento...',
  fields: [
    { name: 'tipo', label: 'Tipo', type: 'select', options: TIPO_LANC, required: true, default: 'despesa', span: 1 },
    { name: 'descricao', label: 'Descrição', required: true, span: 3 },
    { name: 'valor', label: 'Valor', type: 'money', required: true, span: 1 },
    { name: 'vencimento', label: 'Vencimento', type: 'date', required: true, span: 1 },
    { name: 'competencia', label: 'Competência', type: 'date', span: 1 },
    { name: 'status', label: 'Situação', type: 'select', options: STATUS_LANC, default: 'aberto', required: true, span: 1 },
    { name: 'categoria_id', label: 'Categoria', type: 'relation', relation: { endpoint: '/categorias-financeiras' }, span: 2 },
    { name: 'obra_id', label: 'Obra (centro de custo)', type: 'relation', relation: { endpoint: '/obras' }, span: 2 },
    { name: 'parceiro_id', label: 'Cliente / fornecedor', type: 'relation', relation: { endpoint: '/parceiros' }, span: 2 },
    { name: 'conta_id', label: 'Conta', type: 'relation', relation: { endpoint: '/contas-financeiras' }, span: 2 },
    { name: 'forma_pagamento', label: 'Forma de pagamento', type: 'lista', lista: 'forma_pagamento', span: 1 },
    { name: 'numero_documento', label: 'Nº documento / NF', span: 1 },
    { name: 'data_pagamento', label: 'Data do pagamento', type: 'date', span: 1, hidden: (v) => v.status !== 'pago' },
    { name: 'valor_pago', label: 'Valor pago', type: 'money', span: 1, hidden: (v) => v.status !== 'pago' },
    { name: 'observacoes', label: 'Observações', type: 'textarea' },
  ],
  columns: [
    { key: 'descricao', label: 'Descrição', primary: true, render: (r) => <span className="font-medium">{r.descricao}</span> },
    { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_LANC },
    { key: 'vencimento', label: 'Vencimento', type: 'date', render: (r) => <span className={r.atrasado ? 'font-medium text-rose-600' : ''}>{new Date(r.vencimento + 'T12:00').toLocaleDateString('pt-BR')}</span> },
    { key: 'valor', label: 'Valor', align: 'right', render: (r) => <span className={r.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600'}>{moeda(r.valor)}</span> },
    { key: 'status', label: 'Situação', render: (r) => r.atrasado ? <Badge tone="red">Vencido</Badge> : <Badge tone={STATUS_LANC.find((s) => s.value === r.status)?.tone}>{STATUS_LANC.find((s) => s.value === r.status)?.label}</Badge> },
    { key: 'categoria_label', label: 'Categoria', sortable: false, hideMobile: true },
    { key: 'obra_nome', label: 'Obra', sortable: false, hideMobile: true },
    { key: 'parceiro_nome', label: 'Parceiro', sortable: false, hideMobile: true },
  ],
  filters: [
    { name: 'tipo', label: 'Tipo', options: TIPO_LANC },
    { name: 'status', label: 'Situação', options: STATUS_LANC },
    { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' } },
    { name: 'parceiro_id', label: 'Parceiro', type: 'relation', relation: { endpoint: '/parceiros' } },
    { name: 'categoria_id', label: 'Categoria', type: 'relation', relation: { endpoint: '/categorias-financeiras' } },
    { name: 'conta_id', label: 'Conta', type: 'relation', relation: { endpoint: '/contas-financeiras' } },
    { name: 'vencimento__gte', label: 'Vencimento de', type: 'date' },
    { name: 'vencimento__lte', label: 'Vencimento até', type: 'date' },
  ],
  rowActions: (r, reload) => <BaixarButton row={r} onDone={reload} />,
}

export const contasCfg: ResourceConfig = {
  endpoint: '/contas-financeiras', title: 'Contas', singular: 'Conta', perm: 'financeiro', defaultOrder: 'nome', formSize: 'md',
  fields: [
    { name: 'nome', label: 'Nome', required: true },
    { name: 'tipo', label: 'Tipo', type: 'select', required: true, default: 'banco', options: [{ value: 'banco', label: 'Conta bancária' }, { value: 'caixa', label: 'Caixa' }, { value: 'cartao', label: 'Cartão' }, { value: 'investimento', label: 'Investimento' }] },
    { name: 'banco', label: 'Banco', span: 2 }, { name: 'agencia', label: 'Agência', span: 1 }, { name: 'numero', label: 'Conta', span: 1 },
    { name: 'saldo_inicial', label: 'Saldo inicial', type: 'money' }, { name: 'ativa', label: 'Ativa', type: 'boolean', default: true },
  ],
  columns: [{ key: 'nome', label: 'Conta', primary: true }, { key: 'tipo', label: 'Tipo' }, { key: 'banco', label: 'Banco' }, { key: 'saldo_inicial', label: 'Saldo inicial', type: 'money', align: 'right' }, { key: 'ativa', label: 'Ativa', type: 'boolean' }],
}

export const categoriasCfg: ResourceConfig = {
  endpoint: '/categorias-financeiras', title: 'Categorias', singular: 'Categoria', perm: 'financeiro', defaultOrder: 'tipo,nome', formSize: 'md',
  fields: [
    { name: 'nome', label: 'Nome', required: true }, { name: 'tipo', label: 'Tipo', type: 'select', options: TIPO_LANC, required: true, default: 'despesa' },
    { name: 'grupo', label: 'Grupo' }, { name: 'ativa', label: 'Ativa', type: 'boolean', default: true },
  ],
  columns: [{ key: 'nome', label: 'Categoria', primary: true }, { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_LANC }, { key: 'grupo', label: 'Grupo' }, { key: 'ativa', label: 'Ativa', type: 'boolean' }],
  filters: [{ name: 'tipo', label: 'Tipo', options: TIPO_LANC }],
}

registrarCriacao(categoriasCfg)
registrarCriacao(contasCfg)
