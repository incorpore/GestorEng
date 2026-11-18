import { Filter, Plus, Search } from 'lucide-react'
import { Button, Input } from '@/components/ui'

/** Busca + botão de filtros (+ "Novo" quando o cabeçalho da página está oculto). */
export function BarraBusca({ q, onQ, placeholder, temFiltros, ativos, onFiltros, onNovo }: {
  q: string; onQ: (v: string) => void; placeholder?: string; temFiltros: boolean; ativos: number; onFiltros: () => void; onNovo?: () => void
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 p-3 dark:border-slate-800 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder={placeholder || 'Buscar...'} value={q} onChange={(e) => onQ(e.target.value)} />
      </div>
      <div className="flex gap-2">
        {temFiltros && <Button variant="secondary" icon={<Filter className="h-4 w-4" />} onClick={onFiltros}>Filtros{ativos ? ` (${ativos})` : ''}</Button>}
        {onNovo && <Button icon={<Plus className="h-4 w-4" />} onClick={onNovo}>Novo</Button>}
      </div>
    </div>
  )
}
