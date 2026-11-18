import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={clsx('input', className)} {...p} />
})
const VARIANTES_TEXTO = {
  padrao: 'input min-h-[84px]',
  compacto: 'input min-h-0 px-2 py-1', // dentro de tabelas/grades
  codigo: 'block min-h-[480px] w-full resize-y bg-slate-950 p-4 font-mono text-xs leading-relaxed text-emerald-200 outline-none', // HTML/código
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { variante?: keyof typeof VARIANTES_TEXTO }>(
  function Textarea({ className, variante = 'padrao', ...p }, ref) {
    return <textarea ref={ref} className={clsx(VARIANTES_TEXTO[variante], className)} {...p} />
  })
export function Select({ className, children, compacto, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { compacto?: boolean }) {
  return <select className={clsx('input pr-8', compacto && 'w-auto py-1 text-xs', className)} {...p}>{children}</select>
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
