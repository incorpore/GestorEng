import { useState } from 'react'
import { Button, Field, Input, Select, Textarea, Toggle } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'
import type { LinkPublico } from './tipos'

export function NovoLinkForm({ entidade, entidadeId, tipoInicial, onCriado }: {
  entidade: 'diario' | 'obra'; entidadeId: number; tipoInicial: 'visualizar' | 'fotos'; onCriado: (l: LinkPublico) => void
}) {
  const toast = useToast()
  const [v, setV] = useState({ tipo: tipoInicial, destinatario: '', instrucoes: '', validade_dias: 7, exige_localizacao: true, max_fotos: '' })
  const [loading, setLoading] = useState(false)
  async function criar() {
    setLoading(true)
    try {
      onCriado(await api.post('/links-publicos', { ...v, entidade, entidade_id: entidadeId, destinatario: v.destinatario || null,
        instrucoes: v.instrucoes || null, max_fotos: v.max_fotos ? Number(v.max_fotos) : null }))
    } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(['fotos', 'visualizar'] as const).filter((t) => entidade === 'diario' || t === 'fotos').map((t) => (
          <button key={t} type="button" onClick={() => setV({ ...v, tipo: t })}
            className={`rounded-lg border p-3 text-left text-sm ${v.tipo === t ? 'border-primary bg-primary-50 ring-2 ring-primary/20' : 'border-slate-200 dark:border-slate-700'}`}>
            <b className="block">{t === 'fotos' ? 'Pedir fotos' : 'Visualizar diário'}</b>
            <span className="text-xs text-slate-500">{t === 'fotos' ? 'A pessoa envia fotos pelo celular, sem login' : 'Leitura do diário e PDF, sem login'}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Para quem (opcional)"><Input value={v.destinatario} onChange={(e) => setV({ ...v, destinatario: e.target.value })} placeholder="Ex.: Encarregado João" /></Field>
        <Field label="Validade">
          <Select value={v.validade_dias} onChange={(e) => setV({ ...v, validade_dias: Number(e.target.value) })}>
            {[1, 3, 7, 15, 30, 90].map((d) => <option key={d} value={d}>{d} dia(s)</option>)}
          </Select>
        </Field>
        {v.tipo === 'fotos' && <Field label="Limite de fotos (opcional)"><Input type="number" min={1} value={v.max_fotos} onChange={(e) => setV({ ...v, max_fotos: e.target.value })} /></Field>}
      </div>
      {v.tipo === 'fotos' && <Field label="Instruções para quem vai fotografar"><Textarea rows={2} value={v.instrucoes}
        onChange={(e) => setV({ ...v, instrucoes: e.target.value })} placeholder="Ex.: Fotografe as bocas de lobo concluídas, de frente e de cima." /></Field>}
      <Toggle checked={v.exige_localizacao} onChange={(x) => setV({ ...v, exige_localizacao: x })} label="Exigir localização do aparelho para liberar o acesso" />
      <p className="text-xs text-slate-500">Todo acesso registra IP, aparelho, data/hora e, quando autorizado, as coordenadas. A localização só é fornecida pelo navegador em endereços HTTPS.</p>
      <div className="flex justify-end"><Button onClick={criar} loading={loading}>Gerar link</Button></div>
    </div>
  )
}
