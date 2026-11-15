import { Field, Input, Toggle } from '@/components/ui'

const K = [['margem_superior', 'Superior'], ['margem_inferior', 'Inferior'], ['margem_esquerda', 'Esquerda'], ['margem_direita', 'Direita']] as const

/** Margens próprias (mm). Vazio = usa as margens do papel timbrado configurado. */
export function MargensFields({ value, onChange, disabled }: { value: Record<string, number> | null; onChange: (v: Record<string, number> | null) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Toggle checked={!!value} onChange={(on) => onChange(on ? { margem_superior: 40, margem_inferior: 30, margem_esquerda: 25, margem_direita: 20 } : null)}
        label="Margens próprias (senão usa as do timbrado)" />
      {value && (
        <div className="grid grid-cols-2 gap-2">
          {K.map(([k, l]) => (
            <Field key={k} label={`${l} (mm)`}>
              <Input disabled={disabled} type="number" min={0} max={120} value={value[k] ?? 0} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} />
            </Field>
          ))}
        </div>
      )}
    </div>
  )
}
