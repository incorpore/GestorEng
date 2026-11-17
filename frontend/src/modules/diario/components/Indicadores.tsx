import { AlertCircle, Camera, ClipboardList, HardHat } from 'lucide-react'
import clsx from 'clsx'

export function Indicadores({ equipe, servicos, fotos, pendencias }: { equipe: number; servicos: number | null; fotos: number; pendencias: number }) {
  const itens = [
    { icone: HardHat, valor: equipe, rotulo: 'Equipe', cor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    { icone: ClipboardList, valor: servicos != null ? `${Math.round(servicos)}%` : '—', rotulo: 'Serviços', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    { icone: Camera, valor: fotos, rotulo: 'Fotos', cor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
    { icone: AlertCircle, valor: pendencias, rotulo: 'Pendências', cor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map(({ icone: I, valor, rotulo, cor }) => (
        <div key={rotulo} className="card p-4">
          <span className={clsx('inline-flex rounded-xl p-2', cor)}><I className="h-5 w-5" /></span>
          <p className="mt-3 text-3xl font-bold">{valor}</p><p className="text-xs text-slate-500">{rotulo}</p>
        </div>
      ))}
    </div>
  )
}
