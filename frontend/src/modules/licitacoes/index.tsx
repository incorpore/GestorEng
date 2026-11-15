import { lazy, Suspense, useState } from 'react'
import { Gavel } from 'lucide-react'
import { Loading, PageHeader, Tabs } from '@/components/ui'
import { ResourceList } from '@/components/resource/ResourcePage'
import type { FrontModule } from '../types'
import { licitacoesCfg } from './config'

const PncpBusca = lazy(() => import('./PncpBusca'))

function Licitacoes() {
  const [tab, setTab] = useState<'minhas' | 'pncp'>('minhas')
  return (
    <div className="space-y-4">
      <PageHeader title="Licitações" />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'minhas', label: 'Acompanhamento' }, { key: 'pncp', label: 'Buscar no PNCP' }]} />
      <Suspense fallback={<Loading />}>{tab === 'minhas' ? <ResourceList hideHeader cfg={licitacoesCfg} /> : <PncpBusca />}</Suspense>
    </div>
  )
}

const mod: FrontModule = {
  key: 'licitacoes', group: 'Operação',
  nav: [{ label: 'Licitações', path: '/licitacoes', icon: Gavel, perm: ['licitacoes.ver'] }],
  routes: [{ path: '/licitacoes', element: <Licitacoes /> }],
}
export default mod
