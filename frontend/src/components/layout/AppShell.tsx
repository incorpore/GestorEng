import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { IconButton, Loading } from '@/components/ui'
import { BottomNav } from './BottomNav'
import { Brand } from './Brand'
import { MobileDrawer } from './MobileDrawer'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'

export function AppShell() {
  const [drawer, setDrawer] = useState(false)
  return (
    <div className="min-h-full">
      <Sidebar />
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      <div className="md:pl-64">
        <header className="safe-top sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex h-14 items-center justify-between gap-2 px-3 md:h-16 md:px-6">
            <div className="flex items-center gap-1 md:hidden"><IconButton label="Menu" onClick={() => setDrawer(true)}><Menu className="h-5 w-5" /></IconButton><Brand /></div>
            <div className="hidden md:block" />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-3 pb-24 pt-4 md:px-6 md:pb-10 md:pt-6">
          <Suspense fallback={<Loading />}><Outlet /></Suspense>
        </main>
      </div>
      <BottomNav onMenu={() => setDrawer(true)} />
    </div>
  )
}
