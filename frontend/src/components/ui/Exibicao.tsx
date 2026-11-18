import type { ReactNode } from 'react'
import { Inbox, Loader2 } from 'lucide-react'
import clsx from 'clsx'

export function Card({ className, children, title, actions, padded = true }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode; padded?: boolean }) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

const tones: Record<string, string> = {
  gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  red: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  purple: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
}
export function Badge({ tone = 'gray', children }: { tone?: keyof typeof tones | string; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', tones[tone] || tones.gray)}>{children}</span>
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-primary', className)} />
}

export function Loading() {
  return <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
}

export function Empty({ title = 'Nada por aqui', text, action }: { title?: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <Inbox className="h-10 w-10 text-slate-300" />
      <p className="font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {text && <p className="max-w-sm text-sm text-slate-400">{text}</p>}
      {action}
    </div>
  )
}

export function Stat({ label, value, hint, tone, onClick }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'alert'; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={clsx('card p-4 text-left transition enabled:hover:border-primary/40', tone === 'alert' && 'border-rose-200 dark:border-rose-900')}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={clsx('mt-1 text-2xl font-semibold', tone === 'alert' && 'text-rose-600')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </button>
  )
}
