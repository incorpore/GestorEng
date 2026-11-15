import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { PageHeader, Tabs } from '@/components/ui'
import { useAuth } from '@/core/auth'
import type { FrontModule } from '../types'
import { Auditoria } from './Auditoria'
import { Perfis } from './Perfis'
import { Usuarios } from './Usuarios'

function Admin() {
  const { can } = useAuth()
  const [tab, setTab] = useState<'u' | 'p' | 'a'>(can('usuarios.ver') ? 'u' : can('perfis.ver') ? 'p' : 'a')
  return (
    <div className="space-y-4">
      <PageHeader title="Usuários e permissões" />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'u', label: 'Usuários', hidden: !can('usuarios.ver') }, { key: 'p', label: 'Perfis de acesso', hidden: !can('perfis.ver') },
        { key: 'a', label: 'Auditoria', hidden: !can('auditoria.ver') }]} />
      {tab === 'u' && <Usuarios />}{tab === 'p' && <Perfis />}{tab === 'a' && <Auditoria />}
    </div>
  )
}

const mod: FrontModule = {
  key: 'admin', group: 'Sistema',
  nav: [{ label: 'Usuários e acesso', path: '/admin', icon: ShieldCheck, any: ['usuarios.ver', 'perfis.ver', 'auditoria.ver'] }],
  routes: [{ path: '/admin', element: <Admin /> }],
}
export default mod
