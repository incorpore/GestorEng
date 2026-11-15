import { useState } from 'react'
import { Package } from 'lucide-react'
import { PageHeader, Tabs } from '@/components/ui'
import { ResourceList } from '@/components/resource/ResourcePage'
import type { FrontModule } from '../types'
import { itensCfg, locaisCfg, movsCfg } from './config'
import { Saldos } from './Saldos'

function Inventario() {
  const [tab, setTab] = useState<'s' | 'm' | 'i' | 'l'>('s')
  return (
    <div className="space-y-4">
      <PageHeader title="Inventário e almoxarifado" />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 's', label: 'Saldos' }, { key: 'm', label: 'Movimentações' }, { key: 'i', label: 'Itens' }, { key: 'l', label: 'Locais' }]} />
      {tab === 's' && <Saldos />}
      {tab === 'm' && <ResourceList hideHeader cfg={movsCfg} />}
      {tab === 'i' && <ResourceList hideHeader cfg={itensCfg} />}
      {tab === 'l' && <ResourceList hideHeader cfg={locaisCfg} />}
    </div>
  )
}

const mod: FrontModule = {
  key: 'inventario', group: 'Gestão',
  nav: [{ label: 'Inventário', path: '/inventario', icon: Package, perm: ['inventario.ver'] }],
  routes: [{ path: '/inventario', element: <Inventario /> }],
}
export default mod
