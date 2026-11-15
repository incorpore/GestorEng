import { useState } from 'react'
import { Ban, Eye, FileDown, PenLine, RefreshCw, Send } from 'lucide-react'
import { Button, useConfirm } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { openApiFile } from '@/core/files'
import { errMsg, useToast } from '@/core/toast'
import { AssinaturaModal } from './AssinaturaModal'

/** Ações do ciclo de vida: emitir → assinar → sincronizar / cancelar. */
export function DocActions({ doc, dirty, onSave, onChange, onPreview }: {
  doc: any; dirty: boolean; onSave: () => Promise<boolean>; onChange: (d: any) => void; onPreview: () => void
}) {
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)
  const [sign, setSign] = useState(false)
  const nome = `${(doc.numero || doc.titulo).replace(/\//g, '-')}.pdf`

  async function run(k: string, fn: () => Promise<void>) {
    setBusy(k)
    try { await fn() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(null) }
  }

  const emitir = () => run('emitir', async () => {
    if (dirty && !(await onSave())) return
    if (!(await confirm('Ao emitir, as variáveis são congeladas e o PDF definitivo é gerado. O documento não poderá mais ser editado.', { ok: 'Emitir' }))) return
    onChange(await api.post(`/documentos-acoes/${doc.id}/emitir`))
    toast('Documento emitido')
  })

  return (
    <div className="flex flex-wrap gap-2">
      {doc.status === 'rascunho' && <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={onPreview}>Pré-visualizar</Button>}
      {doc.status !== 'rascunho' && <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} loading={busy === 'pdf'}
        onClick={() => run('pdf', () => openApiFile(`/documentos-acoes/${doc.id}/pdf`, nome))}>{doc.pdf_assinado_id ? 'PDF assinado' : 'Abrir PDF'}</Button>}
      {doc.status === 'rascunho' && can('documentos.emitir') && <Button icon={<PenLine className="h-4 w-4" />} loading={busy === 'emitir'} onClick={emitir}>Emitir</Button>}
      {doc.status === 'emitido' && can('documentos.assinar') && <Button icon={<Send className="h-4 w-4" />} onClick={() => setSign(true)}>Enviar p/ assinatura</Button>}
      {doc.documenso_id && doc.status === 'aguardando_assinatura' && <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={busy === 'sync'}
        onClick={() => run('sync', async () => { onChange(await api.post(`/documentos-acoes/${doc.id}/assinatura/sincronizar`)); toast('Status atualizado') })}>Atualizar assinaturas</Button>}
      {!['cancelado', 'rascunho'].includes(doc.status) && can('documentos.emitir') && <Button variant="ghost" icon={<Ban className="h-4 w-4" />}
        onClick={() => run('cancel', async () => { if (await confirm('Cancelar este documento?', { danger: true, ok: 'Cancelar documento' })) onChange(await api.post(`/documentos-acoes/${doc.id}/cancelar`)) })}>Cancelar</Button>}
      <AssinaturaModal docId={doc.id} open={sign} onClose={() => setSign(false)} onSent={onChange} />
    </div>
  )
}
