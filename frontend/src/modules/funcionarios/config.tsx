import type { ResourceConfig } from '@/components/resource/types'
import { moeda } from '@/core/format'
import { VINCULO } from '@/core/options'
import { registrarCriacao } from '@/components/resource/criacao'

const isV = (...v: string[]) => (x: Record<string, any>) => !v.includes(x.vinculo)

export const funcionariosCfg: ResourceConfig = {
  endpoint: '/funcionarios', title: 'Funcionários', singular: 'Funcionário', perm: 'funcionarios', attachEntity: 'funcionario', defaultOrder: 'nome', formSize: 'xl',
  searchPlaceholder: 'Nome, CPF, função...',
  fields: [
    { name: 'nome', label: 'Nome completo', required: true, span: 2 },
    { name: 'vinculo', label: 'Vínculo', type: 'select', options: VINCULO, required: true, default: 'contratado', span: 1 },
    { name: 'funcao', label: 'Função', type: 'lista', lista: 'funcao', span: 1 },
    { name: 'cpf', label: 'CPF', span: 1 }, { name: 'rg', label: 'RG', span: 1 }, { name: 'data_nascimento', label: 'Nascimento', type: 'date', span: 1 },
    { name: 'ativo', label: 'Ativo', type: 'boolean', default: true, span: 1 },
    { name: 'salario', label: 'Salário mensal', type: 'money', span: 1, hidden: isV('contratado'), section: 'Remuneração' },
    { name: 'valor_diaria', label: 'Valor da diária', type: 'money', span: 1, hidden: isV('diaria') },
    { name: 'valor_hora', label: 'Valor da hora', type: 'money', span: 1, hidden: isV('horista') },
    { name: 'valor_empreita', label: 'Valor por unidade', type: 'money', span: 1, hidden: isV('empreita') },
    { name: 'unidade_empreita', label: 'Unidade (m², m³...)', span: 1, hidden: isV('empreita') },
    { name: 'pix', label: 'Chave PIX', span: 1 }, { name: 'banco', label: 'Banco/agência/conta', span: 1 },
    { name: 'obra_id', label: 'Obra atual', type: 'relation', relation: { endpoint: '/obras' }, span: 2, section: 'Alocação e contato' },
    { name: 'telefone', label: 'Telefone', type: 'tel', span: 1 }, { name: 'email', label: 'E-mail', type: 'email', span: 1 },
    { name: 'endereco', label: 'Endereço', span: 4 },
    { name: 'data_admissao', label: 'Admissão', type: 'date', span: 1, section: 'Documentação e SST' }, { name: 'data_demissao', label: 'Desligamento', type: 'date', span: 1 },
    { name: 'ctps', label: 'CTPS', span: 1 }, { name: 'pis', label: 'PIS', span: 1 },
    { name: 'vencimento_aso', label: 'Vencimento ASO', type: 'date', span: 1 },
    { name: 'tamanho_uniforme', label: 'Uniforme', span: 1 }, { name: 'tamanho_calcado', label: 'Calçado', span: 1 },
    { name: 'observacoes', label: 'Observações', type: 'textarea' },
  ],
  columns: [
    { key: 'nome', label: 'Nome', primary: true },
    { key: 'vinculo', label: 'Vínculo', type: 'select', options: VINCULO },
    { key: 'funcao', label: 'Função' },
    { key: 'obra_nome', label: 'Obra', sortable: false },
    { key: 'remuneracao', label: 'Remuneração', sortable: false, render: (r) => {
      const v = { contratado: r.salario, diaria: r.valor_diaria, horista: r.valor_hora, empreita: r.valor_empreita }[r.vinculo as string]
      return v == null ? '•••' : `${moeda(v)}${{ contratado: '/mês', diaria: '/dia', horista: '/h', empreita: `/${r.unidade_empreita || 'un'}` }[r.vinculo as string]}`
    } },
    { key: 'ativo', label: 'Ativo', type: 'boolean', hideMobile: true },
  ],
  filters: [{ name: 'vinculo', label: 'Vínculo', options: VINCULO }, { name: 'ativo', label: 'Ativo', type: 'boolean' },
    { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' } }],
}

export const apontamentosCfg: ResourceConfig = {
  endpoint: '/apontamentos', title: 'Apontamentos', singular: 'Apontamento', perm: 'apontamentos', defaultOrder: '-data', formSize: 'md',
  fields: [
    { name: 'funcionario_id', label: 'Funcionário', type: 'relation', relation: { endpoint: '/funcionarios', params: { ativo: true } }, required: true, span: 4 },
    { name: 'data', label: 'Data', type: 'date', required: true, span: 2 },
    { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' }, span: 2, hint: 'Vazio = obra atual do funcionário' },
    { name: 'diarias', label: 'Diárias', type: 'number', span: 1, hint: 'diaristas' },
    { name: 'horas', label: 'Horas', type: 'number', span: 1, hint: 'horistas' },
    { name: 'horas_extras', label: 'Horas extras', type: 'number', span: 1 },
    { name: 'quantidade', label: 'Produção', type: 'number', span: 1, hint: 'empreita' },
    { name: 'valor_unitario', label: 'Valor unit. (empreita)', type: 'money', span: 2 },
    { name: 'descricao', label: 'Serviço / observação', type: 'textarea' },
  ],
  columns: [
    { key: 'funcionario_nome', label: 'Funcionário', primary: true, sortable: false },
    { key: 'data', label: 'Data', type: 'date' }, { key: 'obra_nome', label: 'Obra', sortable: false },
    { key: 'qtd', label: 'Qtd.', sortable: false, render: (r) => [Number(r.diarias) && `${r.diarias} d`, Number(r.horas) && `${r.horas} h`, Number(r.horas_extras) && `+${r.horas_extras} HE`, Number(r.quantidade) && `${r.quantidade} un`].filter(Boolean).join(' · ') || '—' },
    { key: 'valor', label: 'Valor', align: 'right', render: (r) => (r.valor == null ? '•••' : moeda(r.valor)) },
    { key: 'pago', label: 'Pago', type: 'boolean' },
  ],
  filters: [{ name: 'funcionario_id', label: 'Funcionário', type: 'relation', relation: { endpoint: '/funcionarios' } },
    { name: 'obra_id', label: 'Obra', type: 'relation', relation: { endpoint: '/obras' } }, { name: 'pago', label: 'Pago', type: 'boolean' },
    { name: 'data__gte', label: 'De', type: 'date' }, { name: 'data__lte', label: 'Até', type: 'date' }],
}

registrarCriacao(funcionariosCfg)
