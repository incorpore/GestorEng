import { useState } from 'react'
import { Users } from 'lucide-react'
import { PageHeader, Tabs } from '@/components/ui'
import { ResourceList } from '@/components/resource/ResourcePage'
import { useAuth } from '@/core/auth'
import type { FrontModule } from '../types'
import { apontamentosCfg, funcionariosCfg } from './config'
import { Folha } from './Folha'

function Funcionarios() {
  const { can } = useAuth()
  const [tab, setTab] = useState<'f' | 'a' | 'p'>(can('funcionarios.ver') ? 'f' : 'a')
  return (
    <div className="space-y-4">
      <PageHeader title="Funcionários" />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'f', label: 'Cadastro', hidden: !can('funcionarios.ver') },
        { key: 'a', label: 'Apontamentos', hidden: !can('apontamentos.ver') },
        { key: 'p', label: 'Pagamentos', hidden: !can('apontamentos.ver', 'funcionarios.ver_salarios') },
      ]} />
      {tab === 'f' && <ResourceList hideHeader cfg={funcionariosCfg} />}
      {tab === 'a' && <ResourceList hideHeader cfg={apontamentosCfg} />}
      {tab === 'p' && <Folha />}
    </div>
  )
}

const mod: FrontModule = {
  key: 'funcionarios', group: 'Gestão',
  nav: [{ label: 'Funcionários', path: '/funcionarios', icon: Users, any: ['funcionarios.ver', 'apontamentos.ver'] }],
  routes: [{ path: '/funcionarios', element: <Funcionarios /> }],
}
export default mod
