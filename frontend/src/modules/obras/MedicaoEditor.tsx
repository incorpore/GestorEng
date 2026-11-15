import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { ItemsGrid } from '@/components/resource/ItemsGrid'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { hoje, moeda } from '@/core/format'
import { STATUS_MEDICAO } from '@/core/options'
import { errMsg, useToast } from '@/core/toast'

const vp = (r: any) => Number(r.qtd_periodo || 0) * Number(r.preco_unitario || 0)
const va = (r: any) => (Number(r.qtd_anterior || 0) + Number(r.qtd_periodo || 0)) * Number(r.preco_unitario || 0)

export function MedicaoEditor({ obraId, medicao, onClose, onSaved }: { obraId: number; medicao: any | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const nav = useNavigate()
  const { can } = useAuth()
  const [v, setV] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (medicao) { setV(medicao); return }
    api.get(`/obras/${obraId}/medicoes/proxima`).then((s) =>
      setV({ obra_id: obraId, data: hoje(), status: 'rascunho', periodo_inicio: s.periodo_inicio, periodo_fim: hoje(), itens: s.itens, numero: s.numero }))
  }, [obraId, medicao])

  if (!v) return null
  const readOnly = v.status === 'faturada' && !can('obras.aprovar_medicao')
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  const totalP = (v.itens || []).reduce((a: number, r: any) => a + vp(r), 0)
  const totalA = (v.itens || []).reduce((a: number, r: any) => a + va(r), 0)

  async function save() {
    setSaving(true)
    try {
      const body = { obra_id: obraId, data: v.data, periodo_inicio: v.periodo_inicio || null, periodo_fim: v.periodo_fim || null,
        status: v.status, observacoes: v.observacoes || null,
        itens: (v.itens || []).map((i: any, idx: number) => ({ ordem: idx, codigo: i.codigo || null, descricao: i.descricao || '-', unidade: i.unidade || null,
          qtd_contratada: i.qtd_contratada || 0, qtd_anterior: i.qtd_anterior || 0, qtd_periodo: i.qtd_periodo || 0, preco_unitario: i.preco_unitario || 0 })) }
      const saved = medicao?.id ? await api.patch(`/medicoes/${medicao.id}`, body) : await api.post('/medicoes', body)
      toast('Medição salva')
      onSaved()
      return saved
    } catch (e) { toast(errMsg(e), 'error') } finally { setSaving(false) }
  }

  async function gerarBM() {
    const saved = await save()
    if (!saved) return
    try {
      const modelos = await api.get('/modelos-documento', { tipo: 'boletim_medicao', ativo: true })
      const doc = await api.post('/documentos-acoes/gerar', { modelo_id: modelos.items[0]?.id, tipo: 'boletim_medicao',
        titulo: `Boletim de medição nº ${saved.numero}`, entidade: 'medicao', entidade_id: saved.id })
      nav(`/documentos/${doc.id}`)
    } catch (e) { toast(errMsg(e), 'error') }
  }

  return (
    <Modal open onClose={onClose} size="full" title={`Medição nº ${v.numero ?? ''}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
        {can('documentos.criar') && <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={gerarBM} disabled={readOnly}>Salvar e gerar boletim</Button>}
        <Button onClick={save} loading={saving} disabled={readOnly}>Salvar</Button>
      </>}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="Data"><Input type="date" value={v.data || ''} onChange={(e) => set('data', e.target.value)} /></Field>
        <Field label="Período de"><Input type="date" value={v.periodo_inicio || ''} onChange={(e) => set('periodo_inicio', e.target.value)} /></Field>
        <Field label="até"><Input type="date" value={v.periodo_fim || ''} onChange={(e) => set('periodo_fim', e.target.value)} /></Field>
        <Field label="Situação">
          <Select value={v.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_MEDICAO.filter((o) => can('obras.aprovar_medicao') || !['aprovada', 'faturada'].includes(String(o.value)) || o.value === v.status)
              .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <div className="col-span-2 rounded-lg bg-primary-50 p-2 text-sm sm:col-span-1">
          <p className="text-xs text-slate-500">Período / acumulado</p>
          <p className="font-semibold">{moeda(totalP)}</p>
          <p className="text-xs text-slate-500">{moeda(totalA)}</p>
        </div>
      </div>
      <div className="mt-4">
        <ItemsGrid readOnly={readOnly} rows={v.itens || []} onChange={(r) => set('itens', r)}
          newRow={() => ({ descricao: '', unidade: 'un', qtd_contratada: 0, qtd_anterior: 0, qtd_periodo: 0, preco_unitario: 0 })}
          cols={[
            { key: 'codigo', label: 'Item', width: '80px' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', width: '28%' },
            { key: 'unidade', label: 'Un.', width: '64px' },
            { key: 'qtd_contratada', label: 'Contratado', type: 'number', width: '100px' },
            { key: 'preco_unitario', label: 'Preço unit.', type: 'money', width: '110px' },
            { key: 'qtd_anterior', label: 'Anterior', type: 'number', width: '100px' },
            { key: 'qtd_periodo', label: 'Período', type: 'number', width: '100px' },
            { key: 'acum', label: 'Acumulado', compute: (r) => Number(r.qtd_anterior || 0) + Number(r.qtd_periodo || 0), format: 'number' },
            { key: 'vp', label: 'Valor período', compute: vp, format: 'money' },
            { key: 'pct', label: '%', compute: (r) => (r.qtd_contratada ? ((Number(r.qtd_anterior || 0) + Number(r.qtd_periodo || 0)) / r.qtd_contratada) * 100 : 0), format: 'percent' },
          ]} />
      </div>
      <Field label="Observações" className="mt-4"><Textarea value={v.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)} /></Field>
    </Modal>
  )
}
