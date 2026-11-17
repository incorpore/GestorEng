import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import clsx from 'clsx'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { api } from '@/core/api'
import { hoje } from '@/core/format'
import { errMsg, useToast } from '@/core/toast'

const FORMATOS = [
  { v: 'livreto', t: 'Livreto para impressão', d: 'A5, montado em folhas A4: imprima frente e verso (borda curta), dobre e grampeie' },
  { v: 'a5', t: 'A5 digital', d: 'Páginas A5 em sequência, ideal para enviar por e-mail/WhatsApp' },
  { v: 'a4', t: 'A4', d: 'Páginas A4, fotos maiores' },
]

/** Gera a cartilha da obra (todos os diários de um período) em segundo plano e abre o documento. */
export function CartilhaModal({ obraId, open, onClose }: { obraId: number; open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const toast = useToast()
  const trintaDias = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [v, setV] = useState({ inicio: trintaDias, fim: hoje(), formato: 'livreto', fotos: 'todas', titulo: 'Cartilha da obra' })
  const [loading, setLoading] = useState(false)
  async function gerar() {
    setLoading(true)
    try {
      const r = await api.post('/diarios-acoes/cartilha', { obra_id: obraId, inicio: v.inicio, fim: v.fim, formato: v.formato, titulo: v.titulo,
        fotos_por_dia: v.fotos === 'todas' ? null : Number(v.fotos) })
      toast(`Gerando ${r.numero} — acompanhe no documento`, 'info')
      onClose()
      nav(`/documentos/${r.documento_id}`)
    } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Cartilha da obra (PDF)" size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button icon={<BookOpen className="h-4 w-4" />} onClick={gerar} loading={loading}>Gerar cartilha</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="De"><Input type="date" value={v.inicio} onChange={(e) => setV({ ...v, inicio: e.target.value })} /></Field>
          <Field label="Até"><Input type="date" value={v.fim} max={hoje()} onChange={(e) => setV({ ...v, fim: e.target.value })} /></Field>
        </div>
        <div className="space-y-2">
          {FORMATOS.map((f) => (
            <button key={f.v} type="button" onClick={() => setV({ ...v, formato: f.v })}
              className={clsx('w-full rounded-lg border p-3 text-left', v.formato === f.v ? 'border-primary bg-primary-50 ring-2 ring-primary/20' : 'border-slate-200 dark:border-slate-700')}>
              <b className="block text-sm">{f.t}</b><span className="text-xs text-slate-500">{f.d}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fotos por dia">
            <Select value={v.fotos} onChange={(e) => setV({ ...v, fotos: e.target.value })}>
              <option value="todas">Todas</option><option value="9">Até 9</option><option value="6">Até 6</option><option value="3">Até 3</option><option value="0">Sem fotos</option>
            </Select>
          </Field>
          <Field label="Título da capa"><Input value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-slate-500">A cartilha usa as cores e o logo da empresa (Configurações › Empresa), traz capa, resumo da obra, sumário, todos os diários com fotos e espaço para assinaturas. Depois de gerada, pode ser enviada para assinatura no Documenso.</p>
      </div>
    </Modal>
  )
}
