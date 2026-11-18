import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Field, Loading, Modal, Textarea, Toggle } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'
import { AvisoRepresentante } from './assinatura/AvisoRepresentante'
import { ListaAssinantes } from './assinatura/ListaAssinantes'
import { type PosicaoEmail, SecaoPosicoes } from './assinatura/SecaoPosicoes'
import { type Assinante, mesmoEmail, novoId, type Recente } from './assinatura/tipos'
import { PASTA_AUTO, PASTA_RAIZ, PastaDocumenso } from './PastaDocumenso'

interface Padrao { representante: { nome: string; email: string; cargo: string }; recentes: Recente[]; pasta_auto?: string[]; nome?: string }

/** Envio do PDF emitido para assinatura no Documenso: quem assina (ordem por arrastar), onde assina,
 *  em qual pasta fica e a mensagem. O representante legal é sempre assinante. */
export function AssinaturaModal({ docId, open, onClose, onSent }: { docId: number; open: boolean; onClose: () => void; onSent: (d: any) => void }) {
  const toast = useToast()
  const padrao = useQuery({ queryKey: ['assinatura-padrao', docId], queryFn: () => api.get<Padrao>('/documentos-acoes/assinatura/padrao', { documento_id: docId }), enabled: open })
  const [rows, setRows] = useState<Assinante[]>([])
  const [msg, setMsg] = useState('')
  const [sequencial, setSequencial] = useState(true)
  const [pasta, setPasta] = useState(PASTA_AUTO)
  const [loading, setLoading] = useState(false)
  // posições por e-mail: sobrevivem à reordenação da lista; o índice é recalculado no envio
  const [posicoes, setPosicoes] = useState<PosicaoEmail[]>([])
  const campos = posicoes.map((p) => ({ ...p, indice: rows.findIndex((r) => mesmoEmail(r.email, p.email)) })).filter((p) => p.indice >= 0)
  const rep = padrao.data?.representante
  const repOk = !!rep?.nome && !!rep?.email

  useEffect(() => {
    if (open && padrao.data) {
      const r = padrao.data.representante
      setRows([{ id: novoId(), nome: r.nome, email: r.email, papel: 'SIGNER', representante: true }])
    }
  }, [open, padrao.data])

  async function send() {
    setLoading(true)
    try {
      const d = await api.post(`/documentos-acoes/${docId}/assinatura`, {
        assinantes: rows.map(({ nome, email, papel }) => ({ nome, email, papel })), mensagem: msg || undefined, sequencial,
        pasta_id: pasta === PASTA_AUTO || pasta === PASTA_RAIZ ? null : pasta, pasta_auto: pasta === PASTA_AUTO,
        campos: campos.length ? campos.map(({ indice, pagina, x, y, largura, altura }) => ({ indice, pagina, x, y, largura, altura })) : null })
      onSent(d)
      const aviso = d?.variaveis?._aviso_assinatura
      toast(aviso || 'Enviado para assinatura', aviso ? 'info' : undefined); onClose()
    } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar para assinatura (Documenso)" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={send} loading={loading} disabled={!repOk || rows.some((r) => !r.nome.trim() || !r.email.trim())}>Enviar</Button></>}>
      {padrao.isLoading ? <Loading /> : !repOk ? <AvisoRepresentante onIr={onClose} /> : (
        <>
          {padrao.data?.nome && <p className="mb-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">No Documenso: <b>{[...(pasta === PASTA_AUTO ? padrao.data.pasta_auto || [] : []), padrao.data.nome].join(' / ')}</b></p>}
          <ListaAssinantes rows={rows} onChange={setRows} recentes={padrao.data?.recentes || []} cargo={rep?.cargo} sequencial={sequencial} />
          <SecaoPosicoes docId={docId} rows={rows} campos={campos} onChange={setPosicoes} />
          <div className="mt-3"><PastaDocumenso value={pasta} onChange={setPasta} enabled={open} caminhoAuto={padrao.data?.pasta_auto} /></div>
          <div className="mt-3"><Toggle checked={sequencial} onChange={setSequencial} label="Assinar na ordem da lista (um após o outro)" /></div>
          <Field label="Mensagem" className="mt-3"><Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Por favor, assine o documento." /></Field>
        </>
      )}
    </Modal>
  )
}
