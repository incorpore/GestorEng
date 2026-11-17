import { lazy } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotebookPen, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { ResourcePage } from '@/components/resource/ResourcePage'
import { useAuth } from '@/core/auth'
import type { FrontModule } from '../types'
import { diariosCfg } from './config'

const DiarioVisualizar = lazy(() => import('./DiarioVisualizar'))
const DiarioEditar = lazy(() => import('./DiarioEditar'))

function DiarioList() {
  const nav = useNavigate()
  const { can } = useAuth()
  return <ResourcePage cfg={{ ...diariosCfg, headerActions: can('diario.criar') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => nav('/diario/novo')}>Novo diário</Button> }} />
}

const mod: FrontModule = {
  key: 'diario', group: 'Operação',
  nav: [{ label: 'Diário de obras', path: '/diario', icon: NotebookPen, perm: ['diario.ver'], mobile: true }],
  routes: [{ path: '/diario', element: <DiarioList /> }, { path: '/diario/novo', element: <DiarioEditar /> },
    { path: '/diario/:id', element: <DiarioVisualizar /> }, { path: '/diario/:id/editar', element: <DiarioEditar /> }],
}
export default mod
