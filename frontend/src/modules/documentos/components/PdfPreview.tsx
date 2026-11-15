import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button, Modal, Spinner } from '@/components/ui'
import { api } from '@/core/api'
import { openBlob } from '@/core/files'
import { isNative } from '@/core/platform'
import { errMsg, useToast } from '@/core/toast'

/** Pré-visualização em PDF real (mesmo motor da emissão: timbrado + margens). */
export function PdfPreview({ open, onClose, body, nome = 'preview.pdf' }: { open: boolean; onClose: () => void; body: Record<string, unknown>; nome?: string }) {
  const toast = useToast()
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const blob = await api.blob('/documentos-acoes/preview/pdf', { method: 'POST', body: JSON.stringify(body) })
      if (isNative) { await openBlob(blob, nome); onClose(); return }
      setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob) })
    } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) load() }, [open])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  return (
    <Modal open={open} onClose={onClose} title="Pré-visualização" size="xl"
      footer={<Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={load} loading={loading}>Atualizar</Button>}>
      {loading && !url ? <div className="flex justify-center py-20"><Spinner /></div>
        : url ? <iframe title="PDF" src={url} className="h-[72vh] w-full rounded border border-slate-200" /> : null}
    </Modal>
  )
}
