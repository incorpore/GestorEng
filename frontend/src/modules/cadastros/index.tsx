import { Contact } from 'lucide-react'
import { ResourcePage } from '@/components/resource/ResourcePage'
import type { ResourceConfig } from '@/components/resource/types'
import { TIPO_PARCEIRO } from '@/core/options'
import type { FrontModule } from '../types'

export const parceirosCfg: ResourceConfig = {
  endpoint: '/parceiros', title: 'Clientes, fornecedores e órgãos', singular: 'Cadastro', perm: 'cadastros',
  attachEntity: 'parceiro', searchPlaceholder: 'Nome, CNPJ/CPF, cidade...',
  fields: [
    { name: 'tipo', label: 'Tipo', type: 'select', options: TIPO_PARCEIRO, required: true, default: 'cliente', span: 1 },
    { name: 'pessoa', label: 'Pessoa', type: 'select', options: [{ value: 'PJ', label: 'Jurídica' }, { value: 'PF', label: 'Física' }], required: true, default: 'PJ', span: 1 },
    { name: 'documento', label: 'CNPJ / CPF', span: 2 },
    { name: 'nome', label: 'Razão social / Nome', required: true, span: 2 },
    { name: 'nome_fantasia', label: 'Nome fantasia', span: 2 },
    { name: 'inscricao_estadual', label: 'Inscrição estadual', span: 1 },
    { name: 'contato', label: 'Pessoa de contato', span: 1 },
    { name: 'email', label: 'E-mail', type: 'email', span: 1 },
    { name: 'telefone', label: 'Telefone', type: 'tel', span: 1 },
    { name: 'cep', label: 'CEP', span: 1, section: 'Endereço' },
    { name: 'endereco', label: 'Endereço', span: 3 },
    { name: 'cidade', label: 'Cidade', span: 3 },
    { name: 'uf', label: 'UF', type: 'uf', span: 1 },
    { name: 'pix', label: 'Chave PIX', span: 2, section: 'Pagamento' },
    { name: 'banco', label: 'Dados bancários', span: 2 },
    { name: 'observacoes', label: 'Observações', type: 'textarea' },
    { name: 'ativo', label: 'Ativo', type: 'boolean', default: true },
  ],
  columns: [
    { key: 'nome', label: 'Nome', primary: true },
    { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_PARCEIRO },
    { key: 'documento', label: 'CNPJ/CPF' },
    { key: 'cidade', label: 'Cidade', render: (r) => [r.cidade, r.uf].filter(Boolean).join('/') || '—' },
    { key: 'telefone', label: 'Telefone', hideMobile: true },
  ],
  filters: [
    { name: 'tipo', label: 'Tipo', options: TIPO_PARCEIRO },
    { name: 'ativo', label: 'Ativo', type: 'boolean' },
  ],
  defaultOrder: 'nome',
}

const mod: FrontModule = {
  key: 'cadastros', group: 'Gestão',
  nav: [{ label: 'Cadastros', path: '/cadastros', icon: Contact, perm: ['cadastros.ver'] }],
  routes: [{ path: '/cadastros', element: <ResourcePage cfg={parceirosCfg} /> }],
}
export default mod
