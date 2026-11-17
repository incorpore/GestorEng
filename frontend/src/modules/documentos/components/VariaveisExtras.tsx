import { Plus, Trash2 } from 'lucide-react'
import { Button, IconButton, Input } from '@/components/ui'

/** Variáveis livres do documento, acessíveis como {{ var.nome }}. */
export function VariaveisExtras({ value, onChange, disabled }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void; disabled?: boolean }) {
  // chaves iniciadas por "_" são do sistema (progresso, pasta do Documenso...): ficam ocultas e preservadas
  const entries = Object.entries(value || {}).filter(([k]) => !k.startsWith('_'))
  const setKey = (old: string, k: string) => {
    const n: Record<string, string> = Object.fromEntries(Object.entries(value || {}).filter(([kk]) => kk.startsWith('_')))
    entries.forEach(([kk, vv]) => (n[kk === old ? k.replace(/[^\w]/g, '_') : kk] = vv))
    onChange(n)
  }
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <Input disabled={disabled} className="w-36 font-mono text-xs" value={k} onChange={(e) => setKey(k, e.target.value)} />
          <Input disabled={disabled} value={v ?? ''} onChange={(e) => onChange({ ...value, [k]: e.target.value })} placeholder="valor" />
          {!disabled && <IconButton label="Remover" onClick={() => { const n = { ...value }; delete n[k]; onChange(n) }}><Trash2 className="h-4 w-4" /></IconButton>}
        </div>
      ))}
      {!disabled && <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />}
        onClick={() => onChange({ ...value, [`campo${entries.length + 1}`]: '' })}>Adicionar variável</Button>}
      <p className="text-xs text-slate-400">Use no texto como <code>{'{{ var.nome_do_campo }}'}</code>.</p>
    </div>
  )
}
