import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FileSignature, RefreshCw } from 'lucide-react'
import { Badge, Button, IconButton } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { openApiFile } from '@/core/files'
import { errMsg, useToast } from '@/core/toast'
import { AssinaturaModal } from './AssinaturaModal'

export interface SituacaoAnexo { arquivo_id: number; documento_id: number; numero: string; status: string; assinantes?: { nome: string; status?: string }[] | null }

const ROTULO: Record<string, [string, string]> = {
  emitido: ['Pronto para enviar', 'gray'], aguardando_assinatura: ['Aguardando assinatura', 'yellow'],
  assinado: ['Assinado', 'green'], assinatura_recusada: ['Assinatura recusada', 'red'],
}

/** Situação das assinaturas dos PDFs anexados a um registro. */
export function useAssinaturaAnexos(entidade: string, entidadeId: number, ativo: boolean) {
  const { can } = useAuth()
  return useQuery({
    queryKey: ['anexos-assinatura', entidade, entidadeId],
    queryFn: () => api.get<SituacaoAnexo[]>('/documentos-acoes/anexos', { entidade, entidade_id: entidadeId }),
    enabled: ativo && can('documentos.ver'),
  })
}

/** Ações de assinatura de um PDF anexado: enviar ao Documenso, acompanhar e baixar o assinado. */
export function AnexoAssinatura({ arquivoId, nome, entidade, entidadeId, situacao }: {
  arquivoId: number; nome: string; entidade: string; entidadeId: number; situacao?: SituacaoAnexo
}) {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [docId, setDocId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const recarregar = () => qc.invalidateQueries({ queryKey: ['anexos-assinatura', entidade, entidadeId] })

  async function assinar() {
    setBusy(true)
    try { const r = await api.post(`/documentos-acoes/anexos/${arquivoId}`); setDocId(r.documento_id); recarregar() }
    catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }
  async function sincronizar() {
    setBusy(true)
    try { await api.post(`/documentos-acoes/${situacao!.documento_id}/assinatura/sincronizar`); recarregar() }
    catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  const [rotulo, tom] = situacao ? ROTULO[situacao.status] || [situacao.status, 'gray'] : ['', '']
  const assinados = situacao?.assinantes?.filter((a) => a.status === 'SIGNED').length ?? 0
  return (
    <>
      {situacao && situacao.status !== 'emitido' && (
        <span className="hidden sm:inline" title={situacao.numero}>
          <Badge tone={tom}>{rotulo}{situacao.status === 'aguardando_assinatura' && situacao.assinantes?.length ? ` ${assinados}/${situacao.assinantes.length}` : ''}</Badge>
        </span>
      )}
      {situacao?.status === 'assinado' && (
        <Button size="sm" variant="secondary" icon={<FileSignature className="h-4 w-4" />}
          onClick={() => openApiFile(`/documentos-acoes/${situacao.documento_id}/pdf`, nome.replace(/\.pdf$/i, '') + '-assinado.pdf').catch((e) => toast(errMsg(e), 'error'))}>Assinado</Button>
      )}
      {situacao?.status === 'aguardando_assinatura' && <IconButton label="Atualizar assinaturas" onClick={sincronizar} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></IconButton>}
      {can('documentos.assinar') && (!situacao || situacao.status === 'emitido' || situacao.status === 'assinatura_recusada') && (
        <Button size="sm" variant="secondary" icon={<FileSignature className="h-4 w-4" />} loading={busy} onClick={assinar}>Assinar</Button>
      )}
      {docId !== null && <AssinaturaModal docId={docId} open onClose={() => setDocId(null)} onSent={() => recarregar()} />}
    </>
  )
}
