import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, Field, Input, Loading, PageHeader } from '@/components/ui'
import { api } from '@/core/api'
import { hoje } from '@/core/format'
import { label, TIPO_DOC } from '@/core/options'
import { errMsg, useToast } from '@/core/toast'
import { ContextoFields } from './components/ContextoFields'

export default function NovoDocumento() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const modelos = useQuery({ queryKey: ['/modelos-documento', 'ativos'], queryFn: () => api.get('/modelos-documento', { ativo: true, page_size: 200 }) })
  const [modelo, setModelo] = useState<any>(null)
  const [titulo, setTitulo] = useState('')
  const [destinatario, setDest] = useState('')
  const [ent, setEnt] = useState<{ e: string | null; id: number | null }>({ e: sp.get('entidade'), id: sp.get('id') ? Number(sp.get('id')) : null })
  const [loading, setLoading] = useState(false)

  function pick(m: any) {
    setModelo(m)
    if (!titulo) setTitulo(m ? m.nome : '')
    if (m?.entidade && !ent.e) setEnt({ e: m.entidade, id: null })
  }

  async function criar() {
    setLoading(true)
    try {
      const d = await api.post('/documentos-acoes/gerar', { modelo_id: modelo?.id, tipo: modelo ? undefined : 'outro', titulo, destinatario: destinatario || undefined,
        entidade: ent.e || undefined, entidade_id: ent.id || undefined, data_emissao: hoje() })
      nav(`/documentos/${d.id}`, { replace: true })
    } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader back={() => nav(-1)} title="Novo documento" />
      <Card title="1. Escolha o modelo">
        {modelos.isLoading ? <Loading /> : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <ModeloCard ativo={modelo === null} titulo="Documento em branco" sub="Comece do zero" onClick={() => pick(null)} />
            {modelos.data?.items.map((m: any) => <ModeloCard key={m.id} ativo={modelo?.id === m.id} titulo={m.nome} sub={label(TIPO_DOC, m.tipo)} onClick={() => pick(m)} />)}
          </div>
        )}
      </Card>
      <Card title="2. Dados">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Título" required><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Field>
          <Field label="Destinatário"><Input value={destinatario} onChange={(e) => setDest(e.target.value)} /></Field>
          <ContextoFields entidade={ent.e} entidadeId={ent.id} onChange={(e, id) => setEnt({ e, id })} />
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={criar} loading={loading} disabled={titulo.length < 2}>Criar e editar</Button></div>
      </Card>
    </div>
  )
}

function ModeloCard({ ativo, titulo, sub, onClick }: { ativo: boolean; titulo: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={clsx('flex items-center gap-3 rounded-lg border p-3 text-left transition',
      ativo ? 'border-primary bg-primary-50 ring-2 ring-primary/20' : 'border-slate-200 hover:border-primary/40 dark:border-slate-700')}>
      <FileText className="h-8 w-8 shrink-0 text-primary" />
      <span><span className="block text-sm font-medium">{titulo}</span><span className="text-xs text-slate-500">{sub}</span></span>
    </button>
  )
}
