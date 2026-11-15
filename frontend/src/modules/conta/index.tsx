import { PageHeader } from '@/components/ui'
import { useAuth } from '@/core/auth'
import type { FrontModule } from '../types'
import { DoisFatores } from './components/DoisFatores'
import { Sessoes } from './components/Sessoes'
import { TrocarSenha } from './components/TrocarSenha'

function MinhaConta() {
  const { user } = useAuth()
  return (
    <div className="space-y-4">
      <PageHeader title="Minha conta" subtitle={`${user?.nome} · ${user?.email}`} />
      <TrocarSenha /><DoisFatores /><Sessoes />
    </div>
  )
}

const mod: FrontModule = { key: 'conta', nav: [], routes: [{ path: '/conta', element: <MinhaConta /> }], }
export default mod
