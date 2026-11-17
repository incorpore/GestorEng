import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Camera, Download, FileText, Paperclip, Trash2 } from 'lucide-react'
import { Button, Empty, IconButton, Spinner, useConfirm } from '@/components/ui'
import { FotoGrid, type Foto } from '@/components/fotos/FotoGrid'
import { FotoViewer } from '@/components/fotos/FotoViewer'
import { useEnvioArquivos } from '@/components/fotos/useEnvioArquivos'
import { api } from '@/core/api'
import { bytes, dataHora } from '@/core/format'
import { openApiFile, signedUrl } from '@/core/files'
import { isNative } from '@/core/platform'
import { errMsg, useToast } from '@/core/toast'

/** Anexos de qualquer registro: fotos em grade (com marca d'água nas entidades de obra) e demais arquivos em lista. */
export function Attachments({ entidade, entidadeId, canEdit = true, somenteFotos = false }: {
  entidade: string; entidadeId: number; canEdit?: boolean; somenteFotos?: boolean
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const input = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [aberta, setAberta] = useState<number | null>(null)
  const key = ['arquivos', entidade, entidadeId]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api.get<Foto[]>('/arquivos', { entidade, entidade_id: entidadeId }) })
  const { enviar, enviando } = useEnvioArquivos(entidade, entidadeId)
  const fotos = (data || []).filter((a) => a.mime.startsWith('image/'))
  const outros = somenteFotos ? [] : (data || []).filter((a) => !a.mime.startsWith('image/'))

  async function abrir(a: Foto) {
    try {
      const url = await signedUrl(a.id)
      if (isNative) await openApiFile(url.replace(/^.*\/api/, ''), a.nome)
      else window.open(url, '_blank', 'noopener')
    } catch (e) { toast(errMsg(e), 'error') }
  }
  async function remover(a: Foto) {
    if (!(await confirm(`Remover "${a.descricao || a.nome}"?`, { danger: true, ok: 'Remover' }))) return
    try { await api.del(`/arquivos/${a.id}`); setAberta(null); qc.invalidateQueries({ queryKey: key }) } catch (e) { toast(errMsg(e), 'error') }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" multiple hidden accept={somenteFotos ? 'image/*' : undefined} onChange={(e) => { enviar(e.target.files); e.target.value = '' }} />
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { enviar(e.target.files); e.target.value = '' }} />
          <Button variant="secondary" size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => camera.current?.click()} loading={!!enviando}>
            {enviando ? `Enviando ${enviando.atual}/${enviando.total}` : 'Tirar foto'}
          </Button>
          <Button variant="secondary" size="sm" icon={<Paperclip className="h-4 w-4" />} onClick={() => input.current?.click()} disabled={!!enviando}>
            {somenteFotos ? 'Escolher fotos' : 'Anexar arquivos'}
          </Button>
        </div>
      )}
      {isLoading ? <Spinner /> : !data?.length ? <Empty title={somenteFotos ? 'Sem fotos' : 'Sem anexos'} text="Fotos recebem marca d'água com coordenadas, data e hora." /> : (
        <>
          {fotos.length > 0 && <FotoGrid fotos={fotos} onAbrir={setAberta} />}
          {outros.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {outros.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                  <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => abrir(a)}>
                    <p className="truncate text-sm font-medium">{a.nome}</p>
                    <p className="text-xs text-slate-400">{bytes(a.tamanho)} · {dataHora(a.created_at)}</p>
                  </button>
                  <IconButton label="Abrir" onClick={() => abrir(a)}><Download className="h-4 w-4" /></IconButton>
                  {canEdit && <IconButton label="Remover" className="hover:text-rose-600" onClick={() => remover(a)}><Trash2 className="h-4 w-4" /></IconButton>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {aberta !== null && <FotoViewer fotos={fotos} indice={aberta} onFechar={() => setAberta(null)} podeOriginal={canEdit}
        onExcluir={canEdit ? remover : undefined} />}
    </div>
  )
}
