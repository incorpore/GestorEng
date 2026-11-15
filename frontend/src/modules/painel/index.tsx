import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { Loading, PageHeader, Stat } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { moeda } from '@/core/format'
import type { FrontModule } from '../types'
import { AlertasFrotaCard } from './components/AlertasFrota'
import { AtalhosRapidos } from './components/AtalhosRapidos'
import { ListaLicitacoes } from './components/ListaLicitacoes'
import { ListaObras } from './components/ListaObras'

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function Painel() {
  const { user } = useAuth()
  const nav = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['painel'], queryFn: () => api.get('/painel'), refetchInterval: 120_000 })
  return (
    <div className="space-y-4">
      <PageHeader title={`${saudacao()}, ${user?.nome.split(' ')[0]}`} subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <AtalhosRapidos />
      {isLoading || !data ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.cards.map((c: any) => <Stat key={c.chave} label={c.titulo} value={c.formato === 'moeda' ? moeda(c.valor) : c.valor}
              tone={c.alerta && c.valor ? 'alert' : undefined} onClick={c.link ? () => nav(c.link) : undefined} />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.listas.obras && <ListaObras itens={data.listas.obras} />}
            {data.listas.licitacoes && <ListaLicitacoes itens={data.listas.licitacoes} />}
            {data.listas.frota && <AlertasFrotaCard itens={data.listas.frota} />}
          </div>
        </>
      )}
    </div>
  )
}

const mod: FrontModule = {
  key: 'painel',
  nav: [{ label: 'Painel', path: '/', icon: LayoutDashboard, mobile: true }],
  routes: [{ path: '/', element: <Painel /> }],
}
export default mod
