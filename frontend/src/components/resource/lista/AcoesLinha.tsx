import type { ReactNode } from 'react'
import { Paperclip, Pencil, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { IconButton } from '@/components/ui'

export interface Acoes<T> {
  extras?: (row: T) => ReactNode
  anexos?: (row: T) => void
  editar?: (row: T) => void
  excluir?: (row: T) => void
}

/** Botões de cada registro (extras do módulo, anexos, editar, excluir). */
export function AcoesLinha<T>({ row, acoes, compacto }: { row: T; acoes: Acoes<T>; compacto?: boolean }) {
  const cls = compacto ? 'h-8 w-8' : undefined
  return (
    <div className={clsx('flex gap-0.5', compacto ? 'shrink-0' : 'justify-end')} onClick={(e) => e.stopPropagation()}>
      {acoes.extras?.(row)}
      {acoes.anexos && <IconButton label="Anexos" className={cls} onClick={() => acoes.anexos!(row)}><Paperclip className="h-4 w-4" /></IconButton>}
      {acoes.editar && <IconButton label="Editar" className={cls} onClick={() => acoes.editar!(row)}><Pencil className="h-4 w-4" /></IconButton>}
      {acoes.excluir && <IconButton label="Excluir" className={clsx(cls, 'hover:text-rose-600')} onClick={() => acoes.excluir!(row)}><Trash2 className="h-4 w-4" /></IconButton>}
    </div>
  )
}
