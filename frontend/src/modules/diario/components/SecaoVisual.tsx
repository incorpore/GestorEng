import clsx from 'clsx'
import { Badge, Card } from '@/components/ui'
import { numero } from '@/core/format'
import type { SecaoDef } from '../secoes'

function Valor({ k, v }: { k: string; v: any }) {
  if (k === 'percentual') {
    const p = Math.min(100, Number(v || 0))
    return <span className="inline-flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <span className={clsx('block h-full rounded-full', p >= 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${p}%` }} /></span><b>{numero(v, 0)}%</b></span>
  }
  if (k === 'resolvida') return v ? <Badge tone="green">Resolvida</Badge> : <Badge tone="yellow">Em aberto</Badge>
  if (k === 'gravidade') return <Badge tone={v === 'alta' ? 'red' : v === 'media' ? 'yellow' : 'gray'}>{String(v)}</Badge>
  if (k === 'prazo' && v) return <>{new Date(v + 'T12:00').toLocaleDateString('pt-BR')}</>
  if (k === 'empresa' && v === 'propria') return <>Própria</>
  if (typeof v === 'number') return <>{numero(v, k === 'horas' ? 2 : undefined)}</>
  return <>{String(v)}</>
}

/** Leitura de uma seção: cada item em blocos "rótulo → valor", como no relatório. */
export function SecaoVisual({ def, itens }: { def: SecaoDef; itens: any[] }) {
  if (!itens?.length) return null
  const Icone = def.icone
  return (
    <Card title={<span className="flex items-center gap-2"><span className={clsx('rounded-lg p-1.5', def.cor)}><Icone className="h-4 w-4" /></span>{def.titulo}
      <span className="rounded-full bg-slate-100 px-2 text-xs font-normal text-slate-500 dark:bg-slate-800">{itens.length} registro(s)</span></span>}>
      <div className="space-y-2">
        {itens.map((item, i) => (
          <dl key={i} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/40">
            {def.campos.filter((c) => item[c.key] !== null && item[c.key] !== undefined && item[c.key] !== '' && !(c.key === 'quantidade' && item[c.key] === 1)).map((c) => (
              <div key={c.key} className="contents">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</dt>
                <dd className="text-right text-slate-800 dark:text-slate-200"><Valor k={c.key} v={item[c.key]} /></dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </Card>
  )
}
