import type { ResourceConfig } from '@/components/resource/types'
import { STATUS_DOC, TIPO_DOC } from '@/core/options'

export const documentosCfg: ResourceConfig = {
  endpoint: '/documentos', title: 'Documentos', singular: 'Documento', perm: 'documentos', canCreate: false, fields: [],
  rowLink: (r) => `/documentos/${r.id}`, defaultOrder: '-data_emissao', searchPlaceholder: 'Número, título, destinatário...',
  columns: [
    { key: 'titulo', label: 'Documento', primary: true, render: (r) => <span><span className="font-medium">{r.titulo}</span>{r.numero && <span className="block text-xs text-slate-400">{r.numero}</span>}</span> },
    { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_DOC },
    { key: 'data_emissao', label: 'Emissão', type: 'date' },
    { key: 'destinatario', label: 'Destinatário', hideMobile: true },
    { key: 'status', label: 'Situação', type: 'select', options: STATUS_DOC },
  ],
  filters: [
    { name: 'tipo', label: 'Tipo', options: TIPO_DOC }, { name: 'status', label: 'Situação', options: STATUS_DOC },
    { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' } },
  ],
}

export const modelosCfg: ResourceConfig = {
  endpoint: '/modelos-documento', title: 'Modelos de documento', singular: 'Modelo', perm: 'modelos', canCreate: false, fields: [],
  rowLink: (r) => `/documentos/modelos/${r.id}`, defaultOrder: 'tipo,nome',
  columns: [
    { key: 'nome', label: 'Modelo', primary: true },
    { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_DOC },
    { key: 'entidade', label: 'Contexto' },
    { key: 'orientacao', label: 'Orientação' },
    { key: 'ativo', label: 'Ativo', type: 'boolean' },
  ],
  filters: [{ name: 'tipo', label: 'Tipo', options: TIPO_DOC }],
}
