import { X } from 'lucide-react'
import { IconButton } from '@/components/ui'
import { Brand } from './Brand'
import { SidebarNav } from './Sidebar'

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <aside className="safe-top absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl dark:bg-slate-900">
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800"><Brand /><IconButton label="Fechar" onClick={onClose}><X className="h-5 w-5" /></IconButton></div>
        <SidebarNav onNavigate={onClose} />
      </aside>
    </div>
  )
}
