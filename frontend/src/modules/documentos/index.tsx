import { lazy, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FilePlus2, FileText, Plus } from 'lucide-react'
import { Button, PageHeader, Tabs } from '@/components/ui'
import { ResourceList } from '@/components/resource/ResourcePage'
import { useAuth } from '@/core/auth'
import type { FrontModule } from '../types'
import { documentosCfg, modelosCfg } from './config'

const DocumentoEditor = lazy(() => import('./DocumentoEditor'))
const NovoDocumento = lazy(() => import('./NovoDocumento'))
const ModeloEditor = lazy(() => import('./ModeloEditor'))

function Documentos() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const { can } = useAuth()
  const [tab, setTab] = useState<'docs' | 'modelos'>(sp.get('aba') === 'modelos' ? 'modelos' : 'docs')
  return (
    <div className="space-y-4">
      <PageHeader title="Documentos" actions={<>
        {tab === 'docs' && can('documentos.criar') && <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => nav('/documentos/novo')}>Novo documento</Button>}
        {tab === 'modelos' && can('modelos.criar') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => nav('/documentos/modelos/novo')}>Novo modelo</Button>}
      </>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'docs', label: 'Documentos emitidos' }, { key: 'modelos', label: 'Modelos', hidden: !can('modelos.ver') }]} />
      {tab === 'docs' ? <ResourceList hideHeader cfg={documentosCfg} /> : <ResourceList hideHeader cfg={modelosCfg} />}
    </div>
  )
}

const mod: FrontModule = {
  key: 'documentos', group: 'Gestão',
  nav: [{ label: 'Documentos', path: '/documentos', icon: FileText, perm: ['documentos.ver'] }],
  routes: [
    { path: '/documentos', element: <Documentos /> },
    { path: '/documentos/novo', element: <NovoDocumento /> },
    { path: '/documentos/modelos/:id', element: <ModeloEditor /> },
    { path: '/documentos/:id', element: <DocumentoEditor /> },
  ],
}
export default mod
