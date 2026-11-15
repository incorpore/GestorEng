import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye, Save } from 'lucide-react'
import { Button, Card, Loading, PageHeader } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'
import { AiDraftButton } from './components/AiDraft'
import { ModeloMeta } from './components/ModeloMeta'
import { PdfPreview } from './components/PdfPreview'
import { RichEditor } from './RichEditor'

const CAMPOS = ['nome', 'tipo', 'entidade', 'conteudo', 'css', 'usar_timbrado', 'orientacao', 'margens', 'prefixo_numero', 'numerar', 'ativo']
const NOVO = { nome: '', tipo: 'oficio', entidade: null, conteudo: '', css: null, usar_timbrado: true, orientacao: 'retrato', margens: null, prefixo_numero: '', numerar: true, ativo: true }

export default function ModeloEditor() {
  const { id } = useParams()
  const isNew = id === 'novo'
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery({ queryKey: ['/modelos-documento', id], queryFn: () => api.get(`/modelos-documento/${id}`), enabled: !isNew })
  const [v, setV] = useState<any>(isNew ? NOVO : null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  useEffect(() => { if (q.data) setV(q.data) }, [q.data])
  if (!v) return <Loading />
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))

  async function save() {
    setSaving(true)
    try {
      const body: any = {}
      CAMPOS.forEach((k) => (body[k] = v[k] === '' ? null : v[k]))
      body.conteudo = v.conteudo || ''
      const r = isNew ? await api.post('/modelos-documento', body) : await api.patch(`/modelos-documento/${id}`, body)
      qc.invalidateQueries({ queryKey: ['/modelos-documento'] })
      toast('Modelo salvo')
      if (isNew) nav(`/documentos/modelos/${r.id}`, { replace: true })
      else setV(r)
    } catch (e) { toast(errMsg(e), 'error') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader back={() => nav('/documentos?aba=modelos')} title={isNew ? 'Novo modelo' : v.nome}
        actions={<>
          <AiDraftButton tipo={v.tipo} conteudo={v.conteudo} onResult={(h, sub) => set('conteudo', sub ? h : (v.conteudo || '') + h)} />
          <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview(true)}>Pré-visualizar</Button>
          <Button icon={<Save className="h-4 w-4" />} onClick={save} loading={saving} disabled={!v.nome}>Salvar</Button>
        </>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card padded={false}><RichEditor value={v.conteudo || ''} onChange={(h) => set('conteudo', h)} entidade={v.entidade} /></Card>
        <ModeloMeta v={v} set={set} />
      </div>
      <PdfPreview open={preview} onClose={() => setPreview(false)}
        body={{ conteudo: v.conteudo || '', css: v.css, usar_timbrado: v.usar_timbrado, orientacao: v.orientacao, margens: v.margens }} />
    </div>
  )
}
