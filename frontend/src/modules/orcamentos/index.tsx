import { lazy } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { ResourcePage } from '@/components/resource/ResourcePage'
import { useAuth } from '@/core/auth'
import type { FrontModule } from '../types'
import { orcamentosCfg } from './config'

const OrcamentoEditor = lazy(() => import('./OrcamentoEditor'))

function Lista() {
  const nav = useNavigate()
  const { can } = useAuth()
  return <ResourcePage cfg={{ ...orcamentosCfg, headerActions: can('orcamentos.criar') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => nav('/orcamentos/novo')}>Novo orçamento</Button> }} />
}

const mod: FrontModule = {
  key: 'orcamentos', group: 'Operação',
  nav: [{ label: 'Orçamentos', path: '/orcamentos', icon: Calculator, perm: ['orcamentos.ver'] }],
  routes: [{ path: '/orcamentos', element: <Lista /> }, { path: '/orcamentos/:id', element: <OrcamentoEditor /> }],
}
export default mod
