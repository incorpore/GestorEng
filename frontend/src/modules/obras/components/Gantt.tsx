import { useMemo } from 'react'
import clsx from 'clsx'

export interface ServicoGantt {
  id: number; descricao: string; local?: string | null; etapa?: string | null; inicio: string; fim: string
  percentual: number; situacao: string; responsavel?: string | null
}

const DIA = 86400000
const d = (s: string) => new Date(s + 'T12:00').getTime()
const COR: Record<string, { barra: string; fill: string }> = {
  concluido: { barra: 'bg-emerald-200 dark:bg-emerald-900', fill: 'bg-emerald-500' },
  atrasado: { barra: 'bg-rose-200 dark:bg-rose-900', fill: 'bg-rose-500' },
  em_andamento: { barra: 'bg-primary/25', fill: 'bg-primary' },
  nao_iniciado: { barra: 'bg-slate-200 dark:bg-slate-700', fill: 'bg-slate-400' },
}
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Gráfico de Gantt: barra planejada (início→fim) com o avanço preenchido; linha vermelha = hoje. */
export function Gantt({ servicos, onSelecionar }: { servicos: ServicoGantt[]; onSelecionar?: (s: ServicoGantt) => void }) {
  const g = useMemo(() => {
    if (!servicos.length) return null
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
    const ini = Math.min(...servicos.map((s) => d(s.inicio)), hoje.getTime()) - 3 * DIA
    const fim = Math.max(...servicos.map((s) => d(s.fim)), hoje.getTime()) + 4 * DIA
    const dias = Math.round((fim - ini) / DIA)
    const dw = Math.max(5, Math.min(26, 1100 / dias))
    const meses: { rot: string; x: number; w: number }[] = []
    const c = new Date(ini); c.setDate(1)
    while (c.getTime() < fim) {
      const prox = new Date(c.getFullYear(), c.getMonth() + 1, 1)
      const a = Math.max(c.getTime(), ini), b = Math.min(prox.getTime(), fim)
      meses.push({ rot: `${MESES[c.getMonth()]}/${String(c.getFullYear()).slice(2)}`, x: ((a - ini) / DIA) * dw, w: ((b - a) / DIA) * dw })
      c.setMonth(c.getMonth() + 1)
    }
    const semanas: number[] = []
    for (let t = ini; t < fim; t += DIA) if (new Date(t).getDay() === 1) semanas.push(((t - ini) / DIA) * dw)
    return { ini, dw, largura: dias * dw, meses, semanas, hojeX: ((hoje.getTime() - ini) / DIA) * dw }
  }, [servicos])

  if (!g) return null
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="relative" style={{ width: `calc(11rem + ${g.largura}px)` }}>
        <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <div className="sticky left-0 z-20 w-44 shrink-0 border-r border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900">Serviço</div>
          <div className="relative h-7" style={{ width: g.largura }}>
            {g.meses.map((m) => <span key={m.x} className="absolute top-1.5 border-l border-slate-300 pl-1 dark:border-slate-700" style={{ left: m.x, width: m.w }}>{m.rot}</span>)}
          </div>
        </div>
        {servicos.map((s) => {
          const x = ((d(s.inicio) - g.ini) / DIA) * g.dw
          const w = Math.max(g.dw, ((d(s.fim) - d(s.inicio)) / DIA + 1) * g.dw)
          const p = Math.min(100, Number(s.percentual) || 0)
          const cor = COR[s.situacao] || COR.nao_iniciado
          return (
            <div key={s.id} className="group flex border-b border-slate-100 last:border-0 dark:border-slate-800">
              <button type="button" onClick={() => onSelecionar?.(s)} title={s.descricao}
                className="sticky left-0 z-10 w-44 shrink-0 truncate border-r border-slate-200 bg-white px-2 py-2 text-left text-xs hover:text-primary dark:border-slate-800 dark:bg-slate-900">
                <span className="block truncate font-medium">{s.descricao}</span>
                <span className="block truncate text-[10px] text-slate-400">{s.local || s.etapa || ' '}</span>
              </button>
              <div className="relative h-11" style={{ width: g.largura }}>
                {g.semanas.map((sx) => <span key={sx} className="absolute inset-y-0 border-l border-dashed border-slate-100 dark:border-slate-800" style={{ left: sx }} />)}
                <button type="button" onClick={() => onSelecionar?.(s)} title={`${s.descricao}: ${p}%`}
                  className={clsx('absolute top-2.5 h-6 overflow-hidden rounded-md text-left shadow-sm transition group-hover:ring-2 group-hover:ring-primary/30', cor.barra)} style={{ left: x, width: w }}>
                  <span className={clsx('block h-full', cor.fill)} style={{ width: `${p}%` }} />
                  {w > 36 && <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-bold text-slate-800 mix-blend-normal dark:text-white">{p.toFixed(0)}%</span>}
                </button>
              </div>
            </div>
          )
        })}
        <span className="pointer-events-none absolute bottom-0 top-7 z-0 w-0.5 bg-rose-500/70" style={{ left: `calc(11rem + ${g.hojeX}px)` }} title="Hoje" />
      </div>
    </div>
  )
}

export const SITUACAO_SERV: Record<string, { rot: string; tom: string }> = {
  concluido: { rot: 'Concluído', tom: 'green' }, atrasado: { rot: 'Atrasado', tom: 'red' },
  em_andamento: { rot: 'Em andamento', tom: 'blue' }, nao_iniciado: { rot: 'Não iniciado', tom: 'gray' },
}
