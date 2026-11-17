import { Star } from 'lucide-react'
import type { ResourceConfig } from '@/components/resource/types'
import { dataHora } from '@/core/format'
import { STATUS_LICITACAO } from '@/core/options'

export const licitacoesCfg: ResourceConfig = {
  endpoint: '/licitacoes', title: 'Licitações', singular: 'Licitação', perm: 'licitacoes', attachEntity: 'licitacao', formSize: 'xl',
  defaultOrder: '-data_abertura', searchPlaceholder: 'Objeto, órgão, número, município...',
  fields: [
    { name: 'numero', label: 'Número / processo', span: 1 },
    { name: 'modalidade', label: 'Modalidade', span: 1 },
    { name: 'status', label: 'Situação', type: 'select', options: STATUS_LICITACAO, required: true, default: 'prospeccao', span: 1 },
    { name: 'favorito', label: 'Favorita', type: 'boolean', span: 1 },
    { name: 'objeto', label: 'Objeto', type: 'textarea', required: true },
    { name: 'orgao_id', label: 'Órgão (cadastro)', type: 'relation', relation: { endpoint: '/parceiros', params: { tipo: 'orgao' } }, span: 2 },
    { name: 'orgao_nome', label: 'Órgão (nome)', span: 2 },
    { name: 'orgao_cnpj', label: 'CNPJ do órgão', span: 1 },
    { name: 'uf', label: 'UF', type: 'uf', span: 1 },
    { name: 'municipio', label: 'Município', type: 'municipio', ufField: 'uf', span: 2 },
    { name: 'data_publicacao', label: 'Publicação', type: 'datetime', span: 1, section: 'Datas e valores' },
    { name: 'data_abertura', label: 'Abertura das propostas', type: 'datetime', span: 1 },
    { name: 'data_encerramento_proposta', label: 'Encerramento', type: 'datetime', span: 1 },
    { name: 'criterio_julgamento', label: 'Critério de julgamento', span: 1 },
    { name: 'valor_estimado', label: 'Valor estimado', type: 'money', span: 2 },
    { name: 'valor_proposta', label: 'Nossa proposta', type: 'money', span: 2 },
    { name: 'responsavel', label: 'Responsável interno', span: 2 },
    { name: 'link_edital', label: 'Link do edital', span: 2 },
    { name: 'link_sistema', label: 'Link do sistema de disputa', span: 4 },
    { name: 'observacoes', label: 'Observações', type: 'textarea' },
  ],
  columns: [
    { key: 'objeto', label: 'Objeto', primary: true, render: (r) => <span className="line-clamp-2 max-w-xl">{r.favorito && <Star className="mr-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}{r.objeto}</span> },
    { key: 'orgao_nome', label: 'Órgão' },
    { key: 'municipio', label: 'Local', render: (r) => [r.municipio, r.uf].filter(Boolean).join('/') || '—', hideMobile: true },
    { key: 'data_abertura', label: 'Abertura', render: (r) => dataHora(r.data_abertura) },
    { key: 'valor_estimado', label: 'Estimado', type: 'money', align: 'right' },
    { key: 'status', label: 'Situação', type: 'select', options: STATUS_LICITACAO },
  ],
  filters: [
    { name: 'status', label: 'Situação', options: STATUS_LICITACAO },
    { name: 'favorito', label: 'Favoritas', type: 'boolean' },
    { name: 'data_abertura__gte', label: 'Abertura a partir de', type: 'date' },
  ],
}
