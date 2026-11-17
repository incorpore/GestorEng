import { useState } from 'react'
import { CloudSun } from 'lucide-react'
import { Button, Card, Field, Input, Select } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'
import { CONDICAO, TRABALHO, VENTO } from '../secoes'

type Periodo = { condicao?: string | null; temp_min?: number | null; temp_max?: number | null; umidade?: number | null; vento?: string | null }
export type ClimaDetalhe = { manha?: Periodo | null; tarde?: Periodo | null; noite?: Periodo | null }

const num = (v: string) => (v === '' ? null : Number(v))

function PeriodoCampos({ rotulo, p, onChange, disabled }: { rotulo: string; p: Periodo; onChange: (p: Periodo) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <Select disabled={disabled} value={p.condicao ?? ''} onChange={(e) => onChange({ ...p, condicao: e.target.value || null })}>
        <option value="">Selecione</option>{CONDICAO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
      <div className="grid grid-cols-3 gap-2">
        <Input disabled={disabled} type="number" step="0.1" placeholder="Temp mín" value={p.temp_min ?? ''} onChange={(e) => onChange({ ...p, temp_min: num(e.target.value) })} />
        <Input disabled={disabled} type="number" step="0.1" placeholder="Temp máx" value={p.temp_max ?? ''} onChange={(e) => onChange({ ...p, temp_max: num(e.target.value) })} />
        <Input disabled={disabled} type="number" placeholder="Umidade %" value={p.umidade ?? ''} onChange={(e) => onChange({ ...p, umidade: num(e.target.value) })} />
      </div>
      <Select disabled={disabled} value={p.vento ?? ''} onChange={(e) => onChange({ ...p, vento: e.target.value || null })}>
        <option value="">Vento</option>{VENTO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  )
}

/** Condições climáticas de manhã e tarde, com preenchimento automático pelo OpenWeather. */
export function ClimaEditor({ obraId, data, valor, condicao, onChange, onCondicao, onAtual, disabled }: {
  obraId?: number | null; data: string; valor: ClimaDetalhe; condicao: string; onChange: (v: ClimaDetalhe) => void
  onCondicao: (v: string) => void; onAtual: (v: unknown) => void; disabled?: boolean
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function preencher() {
    if (!obraId) return toast('Selecione a obra', 'error')
    setBusy(true)
    try {
      const r = await api.get(`/clima/obra/${obraId}/periodos`, { data })
      onChange({ ...valor, manha: r.manha || valor.manha, tarde: r.tarde || valor.tarde })
      if (r.condicao_trabalho) onCondicao(r.condicao_trabalho)
      if (r.atual) onAtual(r.atual)
      toast('Condições preenchidas pelo OpenWeather — confira antes de salvar')
    } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }
  return (
    <Card title="Condições climáticas" actions={!disabled && <Button size="sm" variant="secondary" icon={<CloudSun className="h-4 w-4" />} loading={busy} onClick={preencher}>Preencher automaticamente</Button>}>
      <div className="grid gap-4 md:grid-cols-2">
        <PeriodoCampos rotulo="Manhã" p={valor.manha || {}} onChange={(p) => onChange({ ...valor, manha: p })} disabled={disabled} />
        <PeriodoCampos rotulo="Tarde" p={valor.tarde || {}} onChange={(p) => onChange({ ...valor, tarde: p })} disabled={disabled} />
      </div>
      <Field label="Condição de trabalho" className="mt-3 max-w-xs">
        <Select disabled={disabled} value={condicao} onChange={(e) => onCondicao(e.target.value)}>{TRABALHO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
      </Field>
    </Card>
  )
}
