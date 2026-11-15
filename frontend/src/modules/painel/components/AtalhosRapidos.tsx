import { useNavigate } from 'react-router-dom'
import { FilePlus2, NotebookPen, Receipt, UserCheck } from 'lucide-react'
import { useAuth } from '@/core/auth'

export function AtalhosRapidos() {
  const nav = useNavigate()
  const { can, modules } = useAuth()
  const items = [
    { l: 'Novo diário', i: NotebookPen, to: '/diario/novo', ok: modules.has('diario') && can('diario.criar') },
    { l: 'Novo documento', i: FilePlus2, to: '/documentos/novo', ok: modules.has('documentos') && can('documentos.criar') },
    { l: 'Lançamento', i: Receipt, to: '/financeiro?tipo=despesa', ok: modules.has('financeiro') && can('financeiro.criar') },
    { l: 'Apontamento', i: UserCheck, to: '/funcionarios', ok: modules.has('funcionarios') && can('apontamentos.criar') },
  ].filter((x) => x.ok)
  if (!items.length) return null
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(({ l, i: I, to }) => (
        <button key={l} onClick={() => nav(to)} className="card flex items-center gap-2 p-3 text-sm font-medium transition hover:border-primary/40">
          <span className="rounded-lg bg-primary-100 p-2 text-primary"><I className="h-4 w-4" /></span>{l}
        </button>
      ))}
    </div>
  )
}
