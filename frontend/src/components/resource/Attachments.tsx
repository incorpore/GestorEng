import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Camera, Download, FileText, ImageIcon, Paperclip, Trash2 } from 'lucide-react'
import { Button, Empty, IconButton, Spinner } from '@/components/ui'
import { api } from '@/core/api'
import { bytes, dataHora } from '@/core/format'
import { openApiFile, signedUrl } from '@/core/files'
import { isNative } from '@/core/platform'
import { errMsg, useToast } from '@/core/toast'
import { useConfirm } from '@/components/ui'

interface Arq { id: number; nome: string; mime: string; tamanho: number; created_at: string; descricao?: string }

function Thumb({ a }: { a: Arq }) {
  const q = useQuery({ queryKey: ['thumb', a.id], queryFn: () => signedUrl(a.id), staleTime: 8 * 60_000, enabled: a.mime.startsWith('image/') })
  if (!a.mime.startsWith('image/')) return <FileText className="h-8 w-8 text-slate-400" />
  return q.data ? <img src={q.data} alt={a.nome} className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="h-8 w-8 text-slate-300" />
}

export function Attachments({ entidade, entidadeId, canEdit = true }: { entidade: string; entidadeId: number; canEdit?: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const input = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const key = ['arquivos', entidade, entidadeId]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api.get<Arq[]>('/arquivos', { entidade, entidade_id: entidadeId }) })

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData()
        fd.append('arquivo', f)
        fd.append('entidade', entidade)
        fd.append('entidade_id', String(entidadeId))
        await api.post('/arquivos', fd)
      }
      toast('Arquivo(s) enviado(s)')
      qc.invalidateQueries({ queryKey: key })
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
      if (camera.current) camera.current.value = ''
    }
  }

  async function open(a: Arq) {
    try {
      const url = await signedUrl(a.id)
      if (isNative) await openApiFile(url.replace(/^.*\/api/, ''), a.nome)
      else window.open(url, '_blank', 'noopener')
    } catch (e) { toast(errMsg(e), 'error') }
  }

  async function remove(a: Arq) {
    if (!(await confirm(`Remover "${a.nome}"?`, { danger: true, ok: 'Remover' }))) return
    try { await api.del(`/arquivos/${a.id}`); qc.invalidateQueries({ queryKey: key }) } catch (e) { toast(errMsg(e), 'error') }
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-3 flex flex-wrap gap-2">
          <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
          <Button variant="secondary" size="sm" icon={<Paperclip className="h-4 w-4" />} onClick={() => input.current?.click()} loading={uploading}>Anexar arquivo</Button>
          <Button variant="secondary" size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => camera.current?.click()}>Tirar foto</Button>
        </div>
      )}
      {isLoading ? <Spinner /> : !data?.length ? <Empty title="Sem anexos" text="Fotos, PDFs, plantas e documentos ficam aqui." /> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((a) => (
            <li key={a.id} className="group overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <button className="flex aspect-[4/3] w-full items-center justify-center bg-slate-50 dark:bg-slate-800" onClick={() => open(a)}><Thumb a={a} /></button>
              <div className="flex items-center gap-1 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={a.nome}>{a.nome}</p>
                  <p className="text-[11px] text-slate-400">{bytes(a.tamanho)} · {dataHora(a.created_at)}</p>
                </div>
                <IconButton label="Abrir" className="h-7 w-7" onClick={() => open(a)}><Download className="h-3.5 w-3.5" /></IconButton>
                {canEdit && <IconButton label="Remover" className="h-7 w-7 hover:text-rose-600" onClick={() => remove(a)}><Trash2 className="h-3.5 w-3.5" /></IconButton>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
