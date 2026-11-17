import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { useNav } from './useNav'
import { Brand } from './Brand'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { grouped } = useNav()
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {grouped.map((g) => (
        <div key={g.group}>
          {g.group && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.path}>
                <NavLink to={i.path} end={i.path === '/'} onClick={onNavigate}
                  className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-primary-100 text-primary' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
                  <i.icon className="h-[18px] w-[18px]" />{i.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
      <div className="flex h-16 items-center border-b border-slate-100 px-5 dark:border-slate-800"><Brand /></div>
      <SidebarNav />
      <p className="px-5 py-3 text-[11px] text-slate-400">Struvia v1.0</p>
    </aside>
  )
}
