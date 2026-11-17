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
import ErroRota from '@/pages/ErroRota'
import NotFound from '@/pages/NotFound'
import ServerSetup from '@/pages/ServerSetup'
import { lazy, Suspense } from 'react'

// comportamento do React Router 7 já ativado (remove os avisos do console)
const FUTURO = { v7_relativeSplatPath: true, v7_fetcherPersist: true, v7_normalizeFormMethod: true, v7_partialHydration: true, v7_skipActionErrorRevalidation: true }

const LinkPublico = lazy(() => import('@/pages/publico/LinkPublico'))

function Authenticated() {
  const { modules } = useAuth()
  const router = useMemo(() => {
    const routes = frontModules.filter((m) => ALWAYS.has(m.key) || modules.has(m.key)).flatMap((m) => m.routes)
    const tree = [{ element: <AppShell />, errorElement: <ErroRota />, children: [{ errorElement: <ErroRota />, children: [...routes, { path: '*', element: <NotFound /> }] }] }]
    return isNative ? createHashRouter(tree, { future: FUTURO }) : createBrowserRouter(tree, { future: FUTURO })
  }, [modules])
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />
}

function Branding() {
  const { data } = useMarca()
  useEffect(() => { if (data?.cor_primaria) applyBrandColor(data.cor_primaria) }, [data])
  return null
}

export default function App() {
  // link público (sem login): /p/<token>
  const publico = !isNative && /^\/p\/([\w-]{10,100})$/.exec(window.location.pathname)
  if (publico) return <Suspense fallback={<Loading />}><LinkPublico token={publico[1]} /></Suspense>
  return <AppPrivado />
}

function AppPrivado() {
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
