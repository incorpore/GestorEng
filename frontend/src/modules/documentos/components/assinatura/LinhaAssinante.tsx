import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ShieldCheck, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { IconButton, Input, Select } from '@/components/ui'
import { type Assinante, PAPEIS } from './tipos'

/** Uma pessoa da lista de assinatura (arrastável). O representante legal é fixo. */
export function LinhaAssinante({ r, ordem, sugestoes, cargo, set, remover }: {
  r: Assinante; ordem: number; sugestoes: string; cargo?: string; set: (id: string, k: keyof Assinante, v: string) => void; remover: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: r.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx('flex items-start gap-2 rounded-lg border bg-white p-2 dark:bg-slate-900', isDragging ? 'z-10 border-primary shadow-lg' : 'border-slate-200 dark:border-slate-700')}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Mover ${r.nome || 'assinante'}`}
        className="mt-1.5 flex shrink-0 cursor-grab touch-none items-center gap-1 rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing dark:hover:bg-slate-800">
        <GripVertical className="h-5 w-5" /><span className="w-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{ordem}</span>
      </button>
      {r.representante ? (
        <div className="min-w-0 flex-1 py-1.5">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{r.nome}
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary dark:bg-primary/20"><ShieldCheck className="h-3 w-3" />Representante legal{cargo ? ` · ${cargo}` : ''}</span></p>
          <p className="truncate text-xs text-slate-500">{r.email} · assinante obrigatório</p>
        </div>
      ) : (
        <>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_130px]">
            <Input placeholder="Nome" list={sugestoes} value={r.nome} onChange={(e) => set(r.id, 'nome', e.target.value)} />
            <Input placeholder="E-mail" type="email" value={r.email} onChange={(e) => set(r.id, 'email', e.target.value)} />
            <Select value={r.papel} onChange={(e) => set(r.id, 'papel', e.target.value)}>
              {PAPEIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <IconButton label="Remover" onClick={remover}><Trash2 className="h-4 w-4" /></IconButton>
        </>
      )}
    </li>
  )
}
