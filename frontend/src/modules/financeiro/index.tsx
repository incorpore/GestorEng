import { lazy, Suspense, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { Loading, PageHeader, Tabs } from '@/components/ui'
import { ResourceList } from '@/components/resource/ResourcePage'
import { hoje } from '@/core/format'
import type { FrontModule } from '../types'
import { categoriasCfg, contasCfg, lancamentosCfg } from './config'

const Resumo = lazy(() => import('./Resumo'))
type T = 'pagar' | 'receber' | 'todos' | 'resumo' | 'contas' | 'categorias'

function Financeiro() {
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<T>(sp.get('tipo') === 'receita' ? 'receber' : sp.get('tipo') === 'despesa' ? 'pagar' : 'resumo')
  const atrasados = sp.get('atrasados') ? { vencimento__lte: hoje(), status__in: 'aberto,parcial' } : {}
  return (
    <div className="space-y-4">
      <PageHeader title="Financeiro" />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'resumo', label: 'Visão geral' }, { key: 'pagar', label: 'Contas a pagar' }, { key: 'receber', label: 'Contas a receber' },
        { key: 'todos', label: 'Todos os lançamentos' }, { key: 'contas', label: 'Contas' }, { key: 'categorias', label: 'Categorias' },
      ]} />
      <Suspense fallback={<Loading />}>
        {tab === 'resumo' && <Resumo />}
        {tab === 'pagar' && <ResourceList key="p" hideHeader cfg={{ ...lancamentosCfg, baseParams: { tipo: 'despesa', ...atrasados } }} />}
        {tab === 'receber' && <ResourceList key="r" hideHeader cfg={{ ...lancamentosCfg, baseParams: { tipo: 'receita' } }} />}
        {tab === 'todos' && <ResourceList key="t" hideHeader cfg={lancamentosCfg} />}
        {tab === 'contas' && <ResourceList hideHeader cfg={contasCfg} />}
        {tab === 'categorias' && <ResourceList hideHeader cfg={categoriasCfg} />}
      </Suspense>
    </div>
  )
}

const mod: FrontModule = {
  key: 'financeiro', group: 'Gestão',
  nav: [{ label: 'Financeiro', path: '/financeiro', icon: Wallet, perm: ['financeiro.ver'] }],
  routes: [{ path: '/financeiro', element: <Financeiro /> }],
}
export default mod
