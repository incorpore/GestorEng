import { useState } from 'react'
import { Settings } from 'lucide-react'
import { PageHeader, Tabs } from '@/components/ui'
import { useAuth } from '@/core/auth'
import type { FrontModule } from '../types'
import { Backup } from './components/Backup'
import { Empresa } from './components/Empresa'
import { Integracoes } from './components/Integracoes'
import { Modulos } from './components/Modulos'
import { Timbrado } from './components/Timbrado'

type T = 'empresa' | 'timbrado' | 'integracoes' | 'modulos' | 'backup'

function Configuracoes() {
  const { user } = useAuth()
  const [tab, setTab] = useState<T>('empresa')
  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'empresa', label: 'Empresa' }, { key: 'timbrado', label: 'Papel timbrado' }, { key: 'integracoes', label: 'Integrações' },
        { key: 'modulos', label: 'Módulos' }, { key: 'backup', label: 'Backup', hidden: !user?.superusuario }]} />
      {tab === 'empresa' && <Empresa />}{tab === 'timbrado' && <Timbrado />}{tab === 'integracoes' && <Integracoes />}
      {tab === 'modulos' && <Modulos />}{tab === 'backup' && <Backup />}
    </div>
  )
}

const mod: FrontModule = {
  key: 'sistema', group: 'Sistema',
  nav: [{ label: 'Configurações', path: '/configuracoes', icon: Settings, perm: ['configuracoes.ver'] }],
  routes: [{ path: '/configuracoes', element: <Configuracoes /> }],
}
export default mod
