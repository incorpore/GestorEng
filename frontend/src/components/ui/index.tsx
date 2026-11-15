import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes,
  type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-700 shadow-sm',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode
}
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm', variants[variant], className)} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

export function IconButton({ label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100', className)} {...rest} />
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={clsx('input', className)} {...p} />
})
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={clsx('input min-h-[84px]', className)} {...p} />
})
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('input pr-8', className)} {...p}>{children}</select>
}

export function Field({ label, children, hint, className, required }: { label: string; children: ReactNode; hint?: string; className?: string; required?: boolean }) {
  return (
    <label className={clsx('block', className)}>
      <span className="label">{label}{required && <span className="text-rose-500"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm">
      <span className={clsx('relative inline-flex h-5 w-9 items-center rounded-full transition', checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700')}>
        <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white shadow transition', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
      {label}
    </button>
  )
}

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

export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'md:max-w-md', md: 'md:max-w-2xl', lg: 'md:max-w-4xl', xl: 'md:max-w-6xl', full: 'md:max-w-[96vw]' }[size]
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" onClick={onClose} />
      <div ref={ref} className={clsx('relative flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 md:rounded-2xl', w)}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-base font-semibold">{title}</h3>
          <IconButton label="Fechar" onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode; hidden?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 dark:border-slate-800">
      {tabs.filter((t) => !t.hidden).map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={clsx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition',
            value === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: () => void }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {back && <IconButton label="Voltar" onClick={back}><ChevronLeft className="h-5 w-5" /></IconButton>}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return <p className="px-1 py-3 text-xs text-slate-400">{total} registro(s)</p>
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm">
      <span className="text-xs text-slate-500">{total} registros · página {page} de {pages}</span>
      <div className="flex gap-1">
        <IconButton label="Anterior" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /></IconButton>
        <IconButton label="Próxima" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight className="h-4 w-4" /></IconButton>
      </div>
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

// Diálogo de confirmação
const ConfirmCtx = createContext<(msg: string, opts?: { title?: string; danger?: boolean; ok?: string }) => Promise<boolean>>(async () => false)
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ msg: string; title?: string; danger?: boolean; ok?: string; resolve: (v: boolean) => void } | null>(null)
  const confirm = useCallback((msg: string, opts: { title?: string; danger?: boolean; ok?: string } = {}) =>
    new Promise<boolean>((resolve) => setState({ msg, ...opts, resolve })), [])
  const close = (v: boolean) => { state?.resolve(v); setState(null) }
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title || 'Confirmar'} size="sm"
        footer={<><Button variant="secondary" onClick={() => close(false)}>Cancelar</Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state?.ok || 'Confirmar'}</Button></>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">{state?.msg}</p>
      </Modal>
    </ConfirmCtx.Provider>
  )
}
export const useConfirm = () => useContext(ConfirmCtx)
