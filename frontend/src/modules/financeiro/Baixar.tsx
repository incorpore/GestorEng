import { useState } from 'react'
import { CheckCircle2, Undo2 } from 'lucide-react'
import { Button, Field, IconButton, Input, Modal } from '@/components/ui'
import { ListaSelect } from '@/components/resource/ListaSelect'
import { RelationSelect } from '@/components/resource/RelationSelect'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { hoje, moeda } from '@/core/format'
import { errMsg, useToast } from '@/core/toast'
import { useConfirm } from '@/components/ui'

export function BaixarButton({ row, onDone }: { row: any; onDone: () => void }) {
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const restante = Number(row.valor) - Number(row.valor_pago || 0)
  const [v, setV] = useState({ valor: restante, data_pagamento: hoje(), conta_id: row.conta_id, forma_pagamento: row.forma_pagamento || 'PIX' })
  const [saving, setSaving] = useState(false)
  if (!can('financeiro.baixar')) return null

  if (row.status === 'pago') {
    return <IconButton label="Estornar" onClick={async () => {
      if (!(await confirm('Estornar o pagamento deste lançamento?', { ok: 'Estornar' }))) return
      try { await api.post(`/financeiro/lancamentos/${row.id}/estornar`); toast('Pagamento estornado'); onDone() } catch (e) { toast(errMsg(e), 'error') }
    }}><Undo2 className="h-4 w-4" /></IconButton>
  }
  if (row.status === 'cancelado') return null

  async function submit() {
    setSaving(true)
    try { await api.post(`/financeiro/lancamentos/${row.id}/baixar`, v); toast(row.tipo === 'receita' ? 'Recebimento registrado' : 'Pagamento registrado'); setOpen(false); onDone() }
    catch (e) { toast(errMsg(e), 'error') } finally { setSaving(false) }
  }

  return (
    <>
      <IconButton label={row.tipo === 'receita' ? 'Receber' : 'Pagar'} className="text-emerald-600" onClick={() => setOpen(true)}><CheckCircle2 className="h-4 w-4" /></IconButton>
      <Modal open={open} onClose={() => setOpen(false)} size="sm" title={row.tipo === 'receita' ? 'Registrar recebimento' : 'Registrar pagamento'}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button variant="success" onClick={submit} loading={saving}>Confirmar</Button></>}>
        <p className="mb-3 text-sm text-slate-500">{row.descricao} — saldo {moeda(restante)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor"><Input type="number" step="0.01" value={v.valor} onChange={(e) => setV({ ...v, valor: Number(e.target.value) })} /></Field>
          <Field label="Data"><Input type="date" value={v.data_pagamento} onChange={(e) => setV({ ...v, data_pagamento: e.target.value })} /></Field>
          <Field label="Conta" className="col-span-2"><RelationSelect endpoint="/contas-financeiras" value={v.conta_id} onChange={(x) => setV({ ...v, conta_id: x })} /></Field>
          <Field label="Forma" className="col-span-2">
            <ListaSelect lista="forma_pagamento" value={v.forma_pagamento} onChange={(x) => setV({ ...v, forma_pagamento: x || '' })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
