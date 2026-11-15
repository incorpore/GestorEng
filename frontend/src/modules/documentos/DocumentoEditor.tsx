import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { Button, Card, Loading, PageHeader } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'
import { AiDraftButton } from './components/AiDraft'
import { DocActions } from './components/DocActions'
import { DocMeta } from './components/DocMeta'
import { PdfPreview } from './components/PdfPreview'
import { RichEditor } from './RichEditor'

/** Conteúdo emitido vem envolto em {% raw %}; para exibição removemos os marcadores. */
const semRaw = (h: string) => h.replace(/^\{% raw %\}/, '').replace(/\{% endraw %\}$/, '')

const EDITAVEIS = ['titulo', 'destinatario', 'data_emissao', 'conteudo', 'css', 'usar_timbrado', 'orientacao', 'margens', 'variaveis', 'entidade', 'entidade_id']

export default function DocumentoEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery({ queryKey: ['/documentos', Number(id)], queryFn: () => api.get(`/documentos/${id}`) })
  const [v, setV] = useState<any>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  useEffect(() => { if (q.data) { setV(q.data); setDirty(false) } }, [q.data])
  if (!v) return <Loading />

  const readOnly = v.status !== 'rascunho'
  const set = (k: string, x: any) => { setV((s: any) => ({ ...s, [k]: x })); setDirty(true) }

  async function save(): Promise<boolean> {
    setSaving(true)
    try {
      const body: any = {}
      EDITAVEIS.forEach((k) => (body[k] = v[k]))
      setV(await api.patch(`/documentos/${id}`, body))
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['/documentos'] })
      toast('Documento salvo')
      return true
    } catch (e) { toast(errMsg(e), 'error'); return false } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader back={() => nav('/documentos')} title={v.titulo} subtitle={v.numero}
        actions={<>
          {!readOnly && <AiDraftButton tipo={v.tipo} conteudo={v.conteudo} entidade={v.entidade} entidadeId={v.entidade_id}
            onResult={(html, sub) => set('conteudo', sub ? html : `${v.conteudo || ''}${html}`)} />}
          {!readOnly && <Button icon={<Save className="h-4 w-4" />} loading={saving} disabled={!dirty} onClick={save}>Salvar</Button>}
          <DocActions doc={v} dirty={dirty} onSave={save} onChange={(d) => { setV(d); qc.invalidateQueries({ queryKey: ['/documentos'] }) }} onPreview={() => setPreview(true)} />
        </>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card padded={false}><RichEditor key={readOnly ? 'ro' : 'rw'} value={readOnly ? semRaw(v.conteudo || '') : v.conteudo || ''} onChange={(h) => set('conteudo', h)} readOnly={readOnly} entidade={v.entidade} /></Card>
        <DocMeta v={v} set={set} readOnly={readOnly} />
      </div>
      {v.assinantes?.length > 0 && (
        <Card title="Assinaturas">
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {v.assinantes.map((a: any, i: number) => <li key={i} className="flex justify-between py-2"><span>{a.nome} · {a.email}</span><span className="text-slate-500">{a.status}</span></li>)}
          </ul>
        </Card>
      )}
      <PdfPreview open={preview} onClose={() => setPreview(false)} nome={`${v.titulo}.pdf`}
        body={{ conteudo: v.conteudo, css: v.css, entidade: v.entidade, entidade_id: v.entidade_id, variaveis: v.variaveis, usar_timbrado: v.usar_timbrado,
          orientacao: v.orientacao, margens: v.margens, documento_id: v.id }} />
    </div>
  )
}
