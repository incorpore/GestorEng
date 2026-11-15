import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Field, IconButton, Input, Modal, Select, Textarea } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'

interface Assinante { nome: string; email: string; papel: string }

/** Envio do PDF emitido para assinatura eletrônica no Documenso. */
export function AssinaturaModal({ docId, open, onClose, onSent }: { docId: number; open: boolean; onClose: () => void; onSent: (d: any) => void }) {
  const toast = useToast()
  const [rows, setRows] = useState<Assinante[]>([{ nome: '', email: '', papel: 'SIGNER' }])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (i: number, k: keyof Assinante, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  async function send() {
    setLoading(true)
    try { onSent(await api.post(`/documentos-acoes/${docId}/assinatura`, { assinantes: rows, mensagem: msg || undefined })); toast('Enviado para assinatura'); onClose() }
    catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar para assinatura (Documenso)" size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={send} loading={loading} disabled={rows.some((r) => !r.nome || !r.email)}>Enviar</Button></>}>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-2 dark:border-slate-800 sm:grid-cols-[1fr_1fr_140px_auto]">
            <Input placeholder="Nome" value={r.nome} onChange={(e) => set(i, 'nome', e.target.value)} />
            <Input placeholder="E-mail" type="email" value={r.email} onChange={(e) => set(i, 'email', e.target.value)} />
            <Select value={r.papel} onChange={(e) => set(i, 'papel', e.target.value)}>
              <option value="SIGNER">Assinante</option><option value="APPROVER">Aprovador</option><option value="VIEWER">Visualizador</option><option value="CC">Cópia</option>
            </Select>
            <IconButton label="Remover" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></IconButton>
          </div>
        ))}
        <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setRows([...rows, { nome: '', email: '', papel: 'SIGNER' }])}>Adicionar assinante</Button>
      </div>
      <Field label="Mensagem" className="mt-3"><Textarea value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
    </Modal>
  )
}
