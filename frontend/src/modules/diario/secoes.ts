import { AlertTriangle, ClipboardCheck, ClipboardList, Hammer, HardHat, Package, Truck, UserRoundCheck, type LucideIcon } from 'lucide-react'

export interface Opcao { value: string; label: string }
export interface CampoSecao {
  key: string; label: string; tipo?: 'text' | 'number' | 'select' | 'date' | 'bool' | 'textarea' | 'lista'
  opcoes?: Opcao[]; lista?: string; largura?: 'sm' | 'md' | 'lg' | 'full'; placeholder?: string; obrigatorio?: boolean
}
export interface SecaoDef {
  chave: string; titulo: string; icone: LucideIcon; cor: string; campos: CampoSecao[]; novo: () => Record<string, unknown>
  vazio?: string
}

export const CONDICAO: Opcao[] = [
  { value: 'bom', label: 'Céu limpo' }, { value: 'parcialmente_nublado', label: 'Parcialmente nublado' },
  { value: 'nublado', label: 'Nublado' }, { value: 'garoa', label: 'Garoa' }, { value: 'chuvoso', label: 'Chuvoso' },
  { value: 'tempestade', label: 'Tempestade' }, { value: 'impraticavel', label: 'Impraticável' },
]
export const VENTO: Opcao[] = [
  { value: 'sem_vento', label: 'Sem vento' }, { value: 'fraco', label: 'Vento fraco' },
  { value: 'moderado', label: 'Vento moderado' }, { value: 'forte', label: 'Vento forte' },
]
export const TRABALHO: Opcao[] = [
  { value: 'praticavel', label: 'Praticável' }, { value: 'parcial', label: 'Parcialmente praticável' }, { value: 'impraticavel', label: 'Impraticável' },
]
export const ICONE_CLIMA: Record<string, string> = {
  bom: '☀️', parcialmente_nublado: '⛅', nublado: '☁️', garoa: '🌦️', chuvoso: '🌧️', tempestade: '⛈️', impraticavel: '⛈️',
}
export const rotulo = (ops: Opcao[], v: unknown) => ops.find((o) => o.value === v)?.label ?? (v ? String(v) : '—')

export const SECOES: SecaoDef[] = [
  { chave: 'efetivo', titulo: 'Equipe', icone: HardHat, cor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    novo: () => ({ nome: '', funcao: '', horas: 8, quantidade: 1, empresa: 'propria' }),
    campos: [{ key: 'nome', label: 'Nome', largura: 'lg' }, { key: 'funcao', label: 'Função', tipo: 'lista', lista: 'funcao', largura: 'md' },
      { key: 'horas', label: 'Horas', tipo: 'number', largura: 'sm' }, { key: 'quantidade', label: 'Qtd.', tipo: 'number', largura: 'sm' },
      { key: 'empresa', label: 'Empresa', largura: 'md', placeholder: 'propria' }] },
  { chave: 'equipamentos', titulo: 'Máquinas', icone: Truck, cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    novo: () => ({ descricao: '', quantidade: 1, horas: null }),
    campos: [{ key: 'descricao', label: 'Máquina / equipamento', largura: 'lg', obrigatorio: true },
      { key: 'quantidade', label: 'Qtd.', tipo: 'number', largura: 'sm' }, { key: 'horas', label: 'Horas', tipo: 'number', largura: 'sm' }] },
  { chave: 'materiais', titulo: 'Materiais', icone: Package, cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    novo: () => ({ descricao: '', quantidade: null, unidade: '' }),
    campos: [{ key: 'descricao', label: 'Material', largura: 'lg', obrigatorio: true }, { key: 'quantidade', label: 'Qtd.', tipo: 'number', largura: 'sm' },
      { key: 'unidade', label: 'Un.', tipo: 'lista', lista: 'unidade', largura: 'md' }, { key: 'observacao', label: 'Observação', largura: 'md' }] },
  { chave: 'atividades', titulo: 'Serviços', icone: Hammer, cor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    novo: () => ({ descricao: '', local: '', percentual: 0 }),
    campos: [{ key: 'descricao', label: 'Descrição', largura: 'lg', obrigatorio: true }, { key: 'local', label: 'Local', largura: 'md' },
      { key: 'percentual', label: '% executado', tipo: 'number', largura: 'sm' }, { key: 'observacao', label: 'Observação', largura: 'full' }] },
  { chave: 'visitas_lista', titulo: 'Visitas', icone: UserRoundCheck, cor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    novo: () => ({ visitante: '', empresa: '', motivo: '' }),
    campos: [{ key: 'visitante', label: 'Visitante', largura: 'md', obrigatorio: true }, { key: 'empresa', label: 'Empresa', largura: 'md' },
      { key: 'motivo', label: 'Motivo', largura: 'full' }] },
  { chave: 'ocorrencias_lista', titulo: 'Ocorrências', icone: AlertTriangle, cor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    novo: () => ({ descricao: '', tipo: 'outro', gravidade: 'baixa' }),
    campos: [{ key: 'descricao', label: 'Descrição', tipo: 'textarea', largura: 'full', obrigatorio: true },
      { key: 'tipo', label: 'Tipo', tipo: 'select', largura: 'md', opcoes: [{ value: 'acidente', label: 'Acidente' }, { value: 'paralisacao', label: 'Paralisação' },
        { value: 'interferencia', label: 'Interferência' }, { value: 'seguranca', label: 'Segurança' }, { value: 'outro', label: 'Outro' }] },
      { key: 'gravidade', label: 'Gravidade', tipo: 'select', largura: 'sm', opcoes: [{ value: 'baixa', label: 'Baixa' }, { value: 'media', label: 'Média' }, { value: 'alta', label: 'Alta' }] }] },
  { chave: 'pendencias', titulo: 'Pendências', icone: ClipboardList, cor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    novo: () => ({ descricao: '', responsavel: '', prazo: null, resolvida: false }),
    vazio: 'Nenhuma pendência em aberto.',
    campos: [{ key: 'descricao', label: 'Pendência', tipo: 'textarea', largura: 'full', obrigatorio: true }, { key: 'responsavel', label: 'Responsável', largura: 'md' },
      { key: 'prazo', label: 'Prazo', tipo: 'date', largura: 'sm' }, { key: 'resolvida', label: 'Resolvida', tipo: 'bool', largura: 'sm' }] },
  { chave: 'providencias', titulo: 'Providências', icone: ClipboardCheck, cor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    novo: () => ({ descricao: '', responsavel: '', prazo: null }),
    campos: [{ key: 'descricao', label: 'Providência', tipo: 'textarea', largura: 'full', obrigatorio: true }, { key: 'responsavel', label: 'Responsável', largura: 'md' },
      { key: 'prazo', label: 'Prazo', tipo: 'date', largura: 'sm' }] },
]

export const secao = (chave: string) => SECOES.find((s) => s.chave === chave)!
