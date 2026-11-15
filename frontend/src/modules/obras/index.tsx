import { lazy } from 'react'
import { Building2 } from 'lucide-react'
import { ResourcePage } from '@/components/resource/ResourcePage'
import type { FrontModule } from '../types'
import { obrasCfg } from './config'

const ObraDetalhe = lazy(() => import('./ObraDetalhe'))

const mod: FrontModule = {
  key: 'obras', group: 'Operação',
  nav: [{ label: 'Obras', path: '/obras', icon: Building2, perm: ['obras.ver'], mobile: true }],
  routes: [
    { path: '/obras', element: <ResourcePage cfg={obrasCfg} /> },
    { path: '/obras/:id', element: <ObraDetalhe /> },
  ],
}
export default mod
