import { Card, Field, Input, Select, Textarea, Toggle } from '@/components/ui'
import { TIPO_DOC } from '@/core/options'
import { ContextoFields } from './ContextoFields'
import { MargensFields } from './MargensFields'

export function ModeloMeta({ v, set }: { v: any; set: (k: string, x: any) => void }) {
  return (
    <div className="space-y-4">
      <Card title="Modelo">
        <div className="space-y-3">
          <Field label="Nome" required><Input value={v.nome || ''} onChange={(e) => set('nome', e.target.value)} /></Field>
          <Field label="Tipo">
            <Select value={v.tipo} onChange={(e) => set('tipo', e.target.value)}>{TIPO_DOC.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
          </Field>
          <ContextoFields entidade={v.entidade} entidadeId={null} onChange={(e) => set('entidade', e)} />
          <Field label="Prefixo da numeração" hint='Ex.: "Ofício nº" → Ofício nº 012/2026'><Input value={v.prefixo_numero || ''} onChange={(e) => set('prefixo_numero', e.target.value)} /></Field>
          <Toggle checked={!!v.numerar} onChange={(x) => set('numerar', x)} label="Numerar automaticamente" />
          <Toggle checked={!!v.ativo} onChange={(x) => set('ativo', x)} label="Ativo" />
        </div>
      </Card>
      <Card title="Página">
        <div className="space-y-3">
          <Field label="Orientação">
            <Select value={v.orientacao} onChange={(e) => set('orientacao', e.target.value)}><option value="retrato">Retrato</option><option value="paisagem">Paisagem</option></Select>
          </Field>
          <Toggle checked={!!v.usar_timbrado} onChange={(x) => set('usar_timbrado', x)} label="Papel timbrado" />
          <MargensFields value={v.margens} onChange={(m) => set('margens', m)} />
          <Field label="CSS adicional (avançado)"><Textarea className="font-mono text-xs" value={v.css || ''} onChange={(e) => set('css', e.target.value)} /></Field>
        </div>
      </Card>
    </div>
  )
}
