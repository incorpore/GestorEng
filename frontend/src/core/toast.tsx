import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import clsx from 'clsx'

type Kind = 'success' | 'error' | 'info'
interface T { id: number; kind: Kind; msg: string }
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const push = useCallback((msg: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, kind, msg }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-toast flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end" aria-live="polite">
        {items.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertTriangle : Info
          return (
            <div key={t.id} role="status"
              className={clsx('pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg',
                t.kind === 'success' && 'bg-emerald-600', t.kind === 'error' && 'bg-rose-600', t.kind === 'info' && 'bg-slate-800')}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{t.msg}</span>
              <button aria-label="Fechar" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}><X className="h-4 w-4" /></button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)

export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const err = e as { message: string; erros?: { campo: string; mensagem: string }[] }
    if (err.erros?.length) return `${err.message}: ${err.erros.map((x) => `${x.campo} — ${x.mensagem}`).join('; ')}`
    return err.message
  }
  return 'Erro inesperado'
}
