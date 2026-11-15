import { useState } from 'react'
import { Truck } from 'lucide-react'
import { PageHeader, Tabs } from '@/components/ui'
import { ResourceList } from '@/components/resource/ResourcePage'
import type { FrontModule } from '../types'
import { AlertasFrota } from './Alertas'
import { abastecimentosCfg, manutencoesCfg, veiculosCfg } from './config'

function Frota() {
  const [tab, setTab] = useState<'v' | 'm' | 'a' | 'al'>('v')
  return (
    <div className="space-y-4">
      <PageHeader title="Frota e equipamentos" />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'v', label: 'Veículos e máquinas' }, { key: 'm', label: 'Manutenções' }, { key: 'a', label: 'Abastecimentos' }, { key: 'al', label: 'Alertas' }]} />
      {tab === 'v' && <ResourceList hideHeader cfg={veiculosCfg} />}
      {tab === 'm' && <ResourceList hideHeader cfg={manutencoesCfg} />}
      {tab === 'a' && <ResourceList hideHeader cfg={abastecimentosCfg} />}
      {tab === 'al' && <AlertasFrota />}
    </div>
  )
}

const mod: FrontModule = {
  key: 'frota', group: 'Gestão',
  nav: [{ label: 'Frota', path: '/frota', icon: Truck, perm: ['frota.ver'] }],
  routes: [{ path: '/frota', element: <Frota /> }],
}
export default mod
