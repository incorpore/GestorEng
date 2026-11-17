import type { ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, Field, Input, Select, Textarea, Toggle } from '@/components/ui'
import { ListaSelect } from '@/components/resource/ListaSelect'
import type { CampoSecao, SecaoDef } from '../secoes'

const LARG = { sm: 'col-span-1', md: 'col-span-2 sm:col-span-2', lg: 'col-span-2 sm:col-span-3', full: 'col-span-2 sm:col-span-4' }

function Campo({ c, valor, onChange, disabled }: { c: CampoSecao; valor: any; onChange: (v: any) => void; disabled?: boolean }) {
  switch (c.tipo) {
    case 'number':
      return <Input disabled={disabled} type="number" inputMode="decimal" step="any" value={valor ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    case 'date':
      return <Input disabled={disabled} type="date" value={valor ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    case 'select':
      return <Select disabled={disabled} value={valor ?? ''} onChange={(e) => onChange(e.target.value)}>{c.opcoes!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
    case 'lista':
      return <ListaSelect lista={c.lista!} disabled={disabled} value={valor} onChange={(v) => onChange(v ?? '')} />
    case 'bool':
      return <div className="pt-1.5"><Toggle checked={!!valor} onChange={onChange} label={valor ? 'Sim' : 'Não'} /></div>
    case 'textarea':
      return <Textarea disabled={disabled} rows={2} className="min-h-0" value={valor ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={c.placeholder} />
    default:
      return <Input disabled={disabled} value={valor ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={c.placeholder} />
  }
}

/** Card de uma seção do diário com itens editáveis (Equipe, Máquinas, Serviços, Pendências...). */
export function SecaoEditor({ def, itens, onChange, disabled, acoes, topoItem }: {
  def: SecaoDef; itens: any[]; onChange: (v: any[]) => void; disabled?: boolean; acoes?: ReactNode
  topoItem?: (item: any, set: (k: string, v: any) => void) => ReactNode
}) {
  const Icone = def.icone
  const set = (i: number, k: string, v: any) => onChange(itens.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  return (
    <Card title={<span className="flex items-center gap-2"><span className={clsx('rounded-lg p-1.5', def.cor)}><Icone className="h-4 w-4" /></span>{def.titulo}
      {itens.length > 0 && <span className="rounded-full bg-slate-100 px-2 text-xs font-normal text-slate-500 dark:bg-slate-800">{itens.length}</span>}</span>}
      actions={!disabled && <>{acoes}<Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...itens, def.novo()])}>Adicionar</Button></>}>
      {!itens.length ? <p className="text-sm text-slate-400">{def.vazio || 'Nenhum registro.'}</p> : (
        <div className="space-y-3">
          {itens.map((item, i) => (
            <div key={i} className={clsx('relative rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/30',
              item.resolvida && 'opacity-70')}>
              {!disabled && <button type="button" aria-label="Remover" onClick={() => onChange(itens.filter((_, j) => j !== i))}
                className="absolute right-2 top-2 rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"><X className="h-4 w-4" /></button>}
              {topoItem?.(item, (k, v) => set(i, k, v))}
              <div className="grid grid-cols-2 gap-2 pr-6 sm:grid-cols-4">
                {def.campos.map((c) => (
                  <Field key={c.key} label={c.label} required={c.obrigatorio} className={LARG[c.largura || 'md']}>
                    <Campo c={c} valor={item[c.key]} onChange={(v) => set(i, c.key, v)} disabled={disabled} />
                  </Field>
                ))}
              </div>
              {item.origem_data && <p className="mt-1 text-[11px] text-slate-400">Registrada em {new Date(item.origem_data + 'T12:00').toLocaleDateString('pt-BR')}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
