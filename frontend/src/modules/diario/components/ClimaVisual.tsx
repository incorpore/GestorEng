import { CloudSun, Droplets, Thermometer, Wind } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { numero } from '@/core/format'
import { CONDICAO, ICONE_CLIMA, rotulo, TRABALHO, VENTO } from '../secoes'
import type { ClimaDetalhe } from './ClimaEditor'

export function ClimaVisual({ detalhe, manha, tarde, condicao }: { detalhe?: ClimaDetalhe | null; manha?: string | null; tarde?: string | null; condicao: string }) {
  const per = [['Manhã', detalhe?.manha, manha], ['Tarde', detalhe?.tarde, tarde]] as const
  return (
    <Card title={<span className="flex items-center gap-2"><span className="rounded-lg bg-sky-100 p-1.5 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"><CloudSun className="h-4 w-4" /></span>Condições climáticas</span>}
      actions={<Badge tone={condicao === 'impraticavel' ? 'red' : condicao === 'parcial' ? 'yellow' : 'green'}>{rotulo(TRABALHO, condicao)}</Badge>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {per.map(([nome, p, simples]) => {
          const cond = p?.condicao || simples
          return (
            <div key={nome} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{nome}</p>
              {cond ? <>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold"><span className="text-2xl">{ICONE_CLIMA[cond] || '🌤️'}</span>{rotulo(CONDICAO, cond)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {(p?.temp_min != null || p?.temp_max != null) && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700"><Thermometer className="h-3 w-3 text-rose-500" />{numero(p?.temp_min, 1)}° / {numero(p?.temp_max, 1)}°C</span>}
                  {p?.umidade != null && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700"><Droplets className="h-3 w-3 text-sky-500" />{numero(p.umidade, 0)}%</span>}
                  {p?.vento && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700"><Wind className="h-3 w-3" />{rotulo(VENTO, p.vento).toLowerCase()}</span>}
                </div>
              </> : <p className="mt-1 text-sm text-slate-400">Não informado</p>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
