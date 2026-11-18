import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { IconButton } from './Botoes'

/** Camadas da interface, da mais baixa para a mais alta (definidas em tailwind.config.js → zIndex).
 *  Toda sobreposição do sistema usa <Overlay> com uma destas camadas — nunca z-index solto. */
export type Camada = 'drawer' | 'modal' | 'viewer' | 'confirm'
const Z: Record<Camada, string> = { drawer: 'z-drawer', modal: 'z-modal', viewer: 'z-viewer', confirm: 'z-confirm' }

// pilha de sobreposições abertas: Esc fecha só a do topo; a rolagem da página fica travada enquanto houver alguma
const pilha: number[] = []
let seq = 0

/** Base de toda sobreposição em tela cheia (pop-up, visualizador de fotos, menu lateral, confirmação). */
export function Overlay({ open = true, onClose, camada = 'modal', className, children, label }: {
  open?: boolean; onClose: () => void; camada?: Camada; className?: string; children: ReactNode; label?: string
}) {
  const id = useRef(0)
  const fechar = useRef(onClose)
  fechar.current = onClose
  useEffect(() => {
    if (!open) return
    id.current = ++seq
    pilha.push(id.current)
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pilha[pilha.length - 1] === id.current) { e.stopPropagation(); fechar.current() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const k = pilha.indexOf(id.current)
      if (k >= 0) pilha.splice(k, 1)
      if (!pilha.length) document.body.style.overflow = ''
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className={clsx('fixed inset-0', Z[camada], className)} role="dialog" aria-modal="true" aria-label={label}>{children}</div>,
    document.body,
  )
}

/** Pop-up padrão do sistema (formulários, detalhes, escolhas). No celular abre de baixo para cima. */
export function Modal({ open, onClose, title, children, footer, size = 'md', camada = 'modal' }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; camada?: Camada
}) {
  const w = { sm: 'md:max-w-md', md: 'md:max-w-2xl', lg: 'md:max-w-4xl', xl: 'md:max-w-6xl', full: 'md:max-w-[96vw]' }[size]
  return (
    <Overlay open={open} onClose={onClose} camada={camada} className="flex items-end justify-center md:items-center md:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className={clsx('relative flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 md:rounded-2xl', w)}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-base font-semibold">{title}</h3>
          <IconButton label="Fechar" onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</footer>}
      </div>
    </Overlay>
  )
}
