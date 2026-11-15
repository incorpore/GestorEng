import type { ReactNode } from 'react'

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'percent' | 'date' | 'datetime' | 'select'
  | 'relation' | 'boolean' | 'email' | 'tel' | 'uf' | 'color'

export interface Option { value: string | number; label: string; tone?: string }

export interface FieldDef {
  name: string
  label: string
  type?: FieldType
  required?: boolean
  options?: Option[]
  /** relação: endpoint de listagem e campo exibido */
  relation?: { endpoint: string; labelKey?: string; params?: Record<string, unknown>; display?: string }
  placeholder?: string
  hint?: string
  span?: 1 | 2 | 3 | 4
  default?: unknown
  hidden?: (values: Record<string, any>) => boolean
  readOnly?: boolean
  step?: string
  section?: string
}

export interface ColumnDef<T = any> {
  key: string
  label: string
  render?: (row: T) => ReactNode
  type?: FieldType
  options?: Option[]
  className?: string
  /** exibido como título no card mobile */
  primary?: boolean
  hideMobile?: boolean
  align?: 'right'
  sortable?: boolean
}

export interface FilterDef {
  name: string
  label: string
  type?: 'select' | 'relation' | 'date' | 'boolean'
  options?: Option[]
  relation?: FieldDef['relation']
}

export interface ResourceConfig<T = any> {
  endpoint: string
  title: string
  singular: string
  perm: string
  fields: FieldDef[]
  columns: ColumnDef<T>[]
  filters?: FilterDef[]
  defaultOrder?: string
  searchPlaceholder?: string
  attachEntity?: string
  rowLink?: (row: T) => string
  rowActions?: (row: T, reload: () => void) => ReactNode
  headerActions?: ReactNode
  baseParams?: Record<string, unknown>
  canCreate?: boolean
  formSize?: 'md' | 'lg' | 'xl'
  /** conteúdo extra no formulário (ex.: editor de itens) */
  extraForm?: (values: Record<string, any>, set: (k: string, v: any) => void) => ReactNode
  transformOut?: (values: Record<string, any>) => Record<string, any>
}
