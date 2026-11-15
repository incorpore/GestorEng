import type { LucideIcon } from 'lucide-react'
import type { RouteObject } from 'react-router-dom'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** exige todas estas permissões */
  perm?: string[]
  /** exige ao menos uma destas */
  any?: string[]
  /** aparece na barra inferior do celular */
  mobile?: boolean
}

export interface FrontModule {
  /** deve corresponder à chave do módulo no backend */
  key: string
  group?: 'Operação' | 'Gestão' | 'Ferramentas' | 'Sistema'
  nav: NavItem[]
  routes: RouteObject[]
}
