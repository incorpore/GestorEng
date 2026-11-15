import { Card, Field, Input, Select } from '@/components/ui'
import { STATUS_DOC, label } from '@/core/options'
import { Badge } from '@/components/ui'
import { ContextoFields } from './ContextoFields'
import { VariaveisExtras } from './VariaveisExtras'
import { MargensFields } from './MargensFields'

/** Painel lateral com os dados do documento (título, destinatário, contexto, layout). */
export function DocMeta({ v, set, readOnly }: { v: any; set: (k: string, x: any) => void; readOnly: boolean }) {
  return (
    <div className="space-y-4">
      <Card title="Documento" actions={<Badge tone={STATUS_DOC.find((s) => s.value === v.status)?.tone}>{label(STATUS_DOC, v.status)}</Badge>}>
        <div className="space-y-3">
          {v.numero && <p className="text-sm font-semibold">{v.numero}</p>}
          <Field label="Título"><Input disabled={readOnly} value={v.titulo || ''} onChange={(e) => set('titulo', e.target.value)} /></Field>
          <Field label="Destinatário"><Input disabled={readOnly} value={v.destinatario || ''} onChange={(e) => set('destinatario', e.target.value)} /></Field>
          <Field label="Data de emissão"><Input type="date" disabled={readOnly} value={v.data_emissao || ''} onChange={(e) => set('data_emissao', e.target.value)} /></Field>
          <ContextoFields disabled={readOnly} entidade={v.entidade} entidadeId={v.entidade_id}
            onChange={(e, id) => { set('entidade', e); set('entidade_id', id) }} />
        </div>
      </Card>
      <Card title="Variáveis do documento"><VariaveisExtras disabled={readOnly} value={v.variaveis || {}} onChange={(x) => set('variaveis', x)} /></Card>
      <Card title="Layout da página">
        <div className="space-y-3">
          <Field label="Orientação">
            <Select disabled={readOnly} value={v.orientacao} onChange={(e) => set('orientacao', e.target.value)}>
              <option value="retrato">Retrato (A4)</option><option value="paisagem">Paisagem (A4)</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={readOnly} checked={!!v.usar_timbrado} onChange={(e) => set('usar_timbrado', e.target.checked)} /> Usar papel timbrado</label>
          <MargensFields disabled={readOnly} value={v.margens} onChange={(m) => set('margens', m)} />
        </div>
      </Card>
    </div>
  )
}
