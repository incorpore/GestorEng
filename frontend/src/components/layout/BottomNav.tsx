import { NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import clsx from 'clsx'
import { useNav } from './useNav'

/** Barra de navegação inferior no celular (atalhos + menu completo). */
export function BottomNav({ onMenu }: { onMenu: () => void }) {
  const { mobile } = useNav()
  const cls = (a: boolean) => clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', a ? 'text-primary' : 'text-slate-500')
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
      {mobile.map((i) => (
        <NavLink key={i.path} to={i.path} end={i.path === '/'} className={({ isActive }) => cls(isActive)}><i.icon className="h-5 w-5" />{i.label.split(' ')[0]}</NavLink>
      ))}
      <button className={cls(false)} onClick={onMenu}><Menu className="h-5 w-5" />Menu</button>
    </nav>
  )
}
