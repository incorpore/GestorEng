import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Moon, Sun, UserCircle } from 'lucide-react'
import { useAuth } from '@/core/auth'
import { useTheme } from '@/core/theme'

export function UserMenu() {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const ini = user?.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800'
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Menu do usuário">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{ini}</span>
        <span className="hidden text-sm font-medium sm:block">{user?.nome.split(' ')[0]}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800"><p className="truncate text-sm font-medium">{user?.nome}</p><p className="truncate text-xs text-slate-500">{user?.email}</p></div>
          <button className={item} onClick={() => { nav('/conta'); setOpen(false) }}><UserCircle className="h-4 w-4" />Minha conta</button>
          <button className={item} onClick={toggle}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{dark ? 'Tema claro' : 'Tema escuro'}</button>
          <button className={`${item} text-rose-600`} onClick={() => logout()}><LogOut className="h-4 w-4" />Sair</button>
        </div>
      )}
    </div>
  )
}
