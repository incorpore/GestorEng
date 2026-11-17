import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookOpen, Calendar, ClipboardList, FilePlus2, MapPin, Pencil, Plus, Send, User } from 'lucide-react'
import { Badge, Button, Card, Empty, Loading, PageHeader, Stat, Tabs } from '@/components/ui'
import { Attachments } from '@/components/resource/Attachments'
import { ResourceForm } from '@/components/resource/ResourceForm'
import { ResourceList } from '@/components/resource/ResourcePage'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { data, moeda } from '@/core/format'
import { label, STATUS_OBRA, TIPO_OBRA } from '@/core/options'
import { diariosCfg } from '../diario/config'
import { documentosCfg } from '../documentos/config'
import { lancamentosCfg } from '../financeiro/config'
import { medicaoStatus, obrasCfg, Progress } from './config'
import { MedicaoEditor } from './MedicaoEditor'
import { CartilhaModal } from './components/CartilhaModal'
import { ClimaHoje } from './components/ClimaHoje'
import { Cronograma } from './components/Cronograma'
import { LinkPublicoModal } from '@/components/links/LinkPublicoModal'

type Tab = 'resumo' | 'cronograma' | 'medicoes' | 'diario' | 'financeiro' | 'documentos' | 'anexos'

export default function ObraDetalhe() {
  const { id } = useParams()
  const obraId = Number(id)
  const nav = useNavigate()
  const qc = useQueryClient()
  const { can, modules } = useAuth()
  const [tab, setTab] = useState<Tab>('resumo')
  const [edit, setEdit] = useState(false)
  const [med, setMed] = useState<any | null | undefined>(undefined)
  const [cartilha, setCartilha] = useState(false)
  const [pedirFotos, setPedirFotos] = useState(false)
  const obra = useQuery({ queryKey: ['/obras', obraId], queryFn: () => api.get(`/obras/${obraId}`) })
  const resumo = useQuery({ queryKey: ['obra-resumo', obraId], queryFn: () => api.get(`/obras/${obraId}/resumo`) })
  const medicoes = useQuery({ queryKey: ['/medicoes', { obra_id: obraId }], queryFn: () => api.get('/medicoes', { obra_id: obraId, page_size: 200 }), enabled: tab === 'medicoes' })

  if (obra.isLoading) return <Loading />
  if (!obra.data) return <Empty title="Obra não encontrada" />
  const o = obra.data
  const r = resumo.data || {}
  const saldoContrato = Number(o.valor_total || 0) - Number(r.medido_acumulado || 0)

  return (
    <div className="space-y-4">
      <PageHeader back={() => nav('/obras')} title={o.nome}
        subtitle={<span className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_OBRA.find((s) => s.value === o.status)?.tone}>{label(STATUS_OBRA, o.status)}</Badge>
          <Badge tone="gray">{label(TIPO_OBRA, o.tipo)}</Badge>
          {o.numero_contrato && <span>Contrato {o.numero_contrato}</span>}
        </span>}
        actions={<>
          {modules.has('diario') && can('diario.ver', 'documentos.criar') && <Button variant="secondary" icon={<BookOpen className="h-4 w-4" />} onClick={() => setCartilha(true)}>Cartilha PDF</Button>}
          {can('obras.editar') && <Button variant="secondary" icon={<Send className="h-4 w-4" />} onClick={() => setPedirFotos(true)}>Pedir fotos</Button>}
          {can('obras.editar') && <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}>Editar</Button>}
        </>} />

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'resumo', label: 'Resumo' },
        { key: 'cronograma', label: 'Cronograma' },
        { key: 'medicoes', label: 'Medições' },
        { key: 'diario', label: 'Diário de obra', hidden: !modules.has('diario') || !can('diario.ver') },
        { key: 'financeiro', label: 'Financeiro', hidden: !modules.has('financeiro') || !can('financeiro.ver') },
        { key: 'documentos', label: 'Documentos', hidden: !modules.has('documentos') || !can('documentos.ver') },
        { key: 'anexos', label: 'Anexos' },
      ]} />

      {tab === 'cronograma' && <Cronograma obraId={obraId} />}
      {tab === 'resumo' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ClimaHoje obraId={obraId} />
            <Card title={<span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-orange-500" />Pendências em aberto
              <span className="rounded-full bg-slate-100 px-2 text-xs font-normal dark:bg-slate-800">{r.pendencias?.length ?? 0}</span></span>}>
              {!r.pendencias?.length ? <p className="text-sm text-slate-400">Nenhuma pendência em aberto no último diário.</p> : (
                <ul className="space-y-2 text-sm">{r.pendencias.map((p: any) => (
                  <li key={p.id} className="rounded-lg bg-orange-50 p-2 dark:bg-orange-950/30"><p>{p.descricao}</p>
                    <p className="text-xs text-slate-500">{[p.responsavel, p.prazo && `prazo ${data(p.prazo)}`, p.origem_data && `desde ${data(p.origem_data)}`].filter(Boolean).join(' · ')}</p></li>
                ))}</ul>
              )}
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Valor do contrato" value={moeda(o.valor_total)} hint={Number(o.valor_aditivos) ? `inclui ${moeda(o.valor_aditivos)} de aditivos` : undefined} />
            <Stat label="Medido acumulado" value={moeda(r.medido_acumulado)} hint={`${r.medicoes ?? 0} medição(ões)`} />
            <Stat label="Saldo contratual" value={moeda(saldoContrato)} />
            <Stat label="Avanço físico" value={`${Number(r.avanco_cronograma ?? o.progresso ?? 0).toFixed(1)}%`} hint={r.avanco_cronograma != null ? 'pelo cronograma' : undefined} onClick={() => setTab('cronograma')} />
          </div>
          {r.financeiro && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Receitas recebidas" value={moeda(r.financeiro.receita_pago || 0)} />
              <Stat label="Receitas a receber" value={moeda((r.financeiro.receita_aberto || 0) + (r.financeiro.receita_parcial || 0))} />
              <Stat label="Despesas pagas" value={moeda(r.financeiro.despesa_pago || 0)} />
              <Stat label="Resultado (realizado)" value={moeda((r.financeiro.receita_pago || 0) - (r.financeiro.despesa_pago || 0))} />
            </div>
          )}
          <Card title="Dados da obra">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Info icon={User} label="Contratante" value={o.cliente_nome} />
              <Info icon={MapPin} label="Local" value={[o.endereco, o.cidade && `${o.cidade}/${o.uf || ''}`].filter(Boolean).join(' — ')} />
              <Info icon={Calendar} label="Prazo" value={`${data(o.data_inicio)} → ${data(o.data_prevista_fim)}${o.prazo_dias ? ` (${o.prazo_dias} dias)` : ''}`} />
              <Info label="Responsável técnico" value={[o.responsavel_tecnico, o.crea_cau].filter(Boolean).join(' · ')} />
              <Info label="ART/RRT" value={o.art_rrt} />
              <Info label="Fiscal do contrato" value={o.fiscal_contrato} />
            </dl>
            {o.objeto && <p className="mt-4 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300"><strong>Objeto: </strong>{o.objeto}</p>}
            <div className="mt-4"><Progress v={o.progresso} /></div>
          </Card>
        </div>
      )}

      {tab === 'medicoes' && (
        <Card title="Boletins de medição" padded={false} actions={can('obras.criar') && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setMed(null)}>Nova medição</Button>}>
          {medicoes.isLoading ? <Loading /> : !medicoes.data?.items.length ? <Empty title="Nenhuma medição" text="A primeira medição é sugerida a partir do orçamento aprovado da obra." /> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {medicoes.data.items.map((m: any) => (
                <li key={m.id}>
                  <button className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => setMed(m)}>
                    <div>
                      <p className="font-medium">Medição nº {m.numero} {medicaoStatus(m.status)}</p>
                      <p className="text-xs text-slate-500">{data(m.periodo_inicio)} a {data(m.periodo_fim)} · {m.itens.length} itens</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{moeda(m.valor_periodo)}</p>
                      <p className="text-xs text-slate-500">acumulado {moeda(m.valor_acumulado)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'diario' && <ResourceList hideHeader cfg={{ ...diariosCfg, baseParams: { obra_id: obraId }, rowLink: (d) => `/diario/${d.id}`,
        headerActions: undefined, canCreate: false }} />}
      {tab === 'diario' && can('diario.criar') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => nav(`/diario/novo?obra=${obraId}`)}>Novo diário</Button>}
      {tab === 'financeiro' && <ResourceList hideHeader cfg={{ ...lancamentosCfg, baseParams: { obra_id: obraId } }} />}
      {tab === 'documentos' && (
        <>
          <ResourceList hideHeader cfg={{ ...documentosCfg, baseParams: { obra_id: obraId } }} />
          {can('documentos.criar') && <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => nav(`/documentos/novo?entidade=obra&id=${obraId}`)}>Novo documento</Button>}
        </>
      )}
      {tab === 'anexos' && <Card><Attachments entidade="obra" entidadeId={obraId} canEdit={can('obras.editar')} /></Card>}

      <ResourceForm open={edit} onClose={() => setEdit(false)} endpoint="/obras" fields={obrasCfg.fields} row={o} title="Editar obra" size="xl"
        onSaved={() => { setEdit(false); qc.invalidateQueries({ queryKey: ['/obras'] }); qc.invalidateQueries({ queryKey: ['obra-resumo', obraId] }) }} />
      <CartilhaModal obraId={obraId} open={cartilha} onClose={() => setCartilha(false)} />
      <LinkPublicoModal entidade="obra" entidadeId={obraId} tipoInicial="fotos" open={pedirFotos} onClose={() => setPedirFotos(false)} />
      {med !== undefined && <MedicaoEditor obraId={obraId} medicao={med} onClose={() => setMed(undefined)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['/medicoes'] }); qc.invalidateQueries({ queryKey: ['obra-resumo', obraId] }) }} />}
    </div>
  )
}

function Info({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-slate-400">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</dt>
      <dd className="mt-0.5">{value || '—'}</dd>
    </div>
  )
}
