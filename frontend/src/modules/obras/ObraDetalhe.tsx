import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookOpen, FilePlus2, Pencil, Plus, Send } from 'lucide-react'
import { Badge, Button, Card, Empty, Loading, PageHeader, Tabs } from '@/components/ui'
import { LinkPublicoModal } from '@/components/links/LinkPublicoModal'
import { Attachments } from '@/components/resource/Attachments'
import { ResourceForm } from '@/components/resource/ResourceForm'
import { ResourceList } from '@/components/resource/ResourcePage'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { label, STATUS_OBRA, TIPO_OBRA } from '@/core/options'
import { diariosCfg } from '../diario/config'
import { documentosCfg } from '../documentos/config'
import { lancamentosCfg } from '../financeiro/config'
import { obrasCfg } from './config'
import { CartilhaModal } from './components/CartilhaModal'
import { Cronograma } from './components/Cronograma'
import { MedicoesObra } from './components/MedicoesObra'
import { ResumoObra } from './components/ResumoObra'

type Tab = 'resumo' | 'cronograma' | 'medicoes' | 'diario' | 'financeiro' | 'documentos' | 'anexos'

/** Página da obra: cabeçalho com ações e abas (cada aba é um componente). */
export default function ObraDetalhe() {
  const { id } = useParams()
  const obraId = Number(id)
  const nav = useNavigate()
  const qc = useQueryClient()
  const { can, modules } = useAuth()
  const [tab, setTab] = useState<Tab>('resumo')
  const [edit, setEdit] = useState(false)
  const [cartilha, setCartilha] = useState(false)
  const [pedirFotos, setPedirFotos] = useState(false)
  const obra = useQuery({ queryKey: ['/obras', obraId], queryFn: () => api.get(`/obras/${obraId}`) })
  const resumo = useQuery({ queryKey: ['obra-resumo', obraId], queryFn: () => api.get(`/obras/${obraId}/resumo`) })

  if (obra.isLoading) return <Loading />
  if (!obra.data) return <Empty title="Obra não encontrada" />
  const o = obra.data
  const ver = (m: string) => modules.has(m) && can(`${m}.ver`)

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
        { key: 'diario', label: 'Diário de obra', hidden: !ver('diario') },
        { key: 'financeiro', label: 'Financeiro', hidden: !ver('financeiro') },
        { key: 'documentos', label: 'Documentos', hidden: !ver('documentos') },
        { key: 'anexos', label: 'Anexos' },
      ]} />

      {tab === 'resumo' && <ResumoObra obra={o} resumo={resumo.data || {}} onCronograma={() => setTab('cronograma')} />}
      {tab === 'cronograma' && <Cronograma obraId={obraId} />}
      {tab === 'medicoes' && <MedicoesObra obraId={obraId} />}
      {tab === 'diario' && (
        <>
          <ResourceList hideHeader cfg={{ ...diariosCfg, baseParams: { obra_id: obraId }, rowLink: (d) => `/diario/${d.id}`, headerActions: undefined, canCreate: false }} />
          {can('diario.criar') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => nav(`/diario/novo?obra=${obraId}`)}>Novo diário</Button>}
        </>
      )}
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
    </div>
  )
}
