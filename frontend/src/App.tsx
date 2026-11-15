import { useEffect, useMemo, useState } from 'react'
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { AppShell } from '@/components/layout/AppShell'
import { useMarca } from '@/components/layout/Brand'
import { Loading } from '@/components/ui'
import { useAuth } from '@/core/auth'
import { applyBrandColor } from '@/core/format'
import { getServerUrl, isNative, loadServerUrl } from '@/core/platform'
import { ALWAYS, frontModules } from '@/modules'
import ForcePassword from '@/pages/ForcePassword'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import ServerSetup from '@/pages/ServerSetup'

function Authenticated() {
  const { modules } = useAuth()
  const router = useMemo(() => {
    const routes = frontModules.filter((m) => ALWAYS.has(m.key) || modules.has(m.key)).flatMap((m) => m.routes)
    const tree = [{ element: <AppShell />, children: [...routes, { path: '*', element: <NotFound /> }] }]
    return isNative ? createHashRouter(tree) : createBrowserRouter(tree)
  }, [modules])
  return <RouterProvider router={router} />
}

function Branding() {
  const { data } = useMarca()
  useEffect(() => { if (data?.cor_primaria) applyBrandColor(data.cor_primaria) }, [data])
  return null
}

export default function App() {
  const [server, setServer] = useState<string | null | undefined>(isNative ? undefined : '')
  const [editServer, setEditServer] = useState(false)

  useEffect(() => { if (isNative) loadServerUrl().then((s) => setServer(s)) }, [])
  useEffect(() => {
    if (!isNative) return
    const h = CapApp.addListener('backButton', ({ canGoBack }) => (canGoBack ? history.back() : CapApp.exitApp()))
    return () => { h.then((x) => x.remove()) }
  }, [])

  if (server === undefined) return <Loading />
  if (isNative && (!server || editServer)) return <ServerSetup initial={getServerUrl()} onDone={() => location.reload()} />
  return <><Branding /><Gate onChangeServer={() => setEditServer(true)} /></>
}

function Gate({ onChangeServer }: { onChangeServer: () => void }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-full items-center justify-center"><Loading /></div>
  if (!user) return <Login onChangeServer={onChangeServer} />
  if (user.trocar_senha) return <ForcePassword />
  return <Authenticated />
}
