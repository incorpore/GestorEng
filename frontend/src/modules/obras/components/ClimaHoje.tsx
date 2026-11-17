import { useQuery } from '@tanstack/react-query'
import { Moon, RefreshCw, Sun } from 'lucide-react'
import { Card, IconButton, Spinner } from '@/components/ui'
import { api, ApiError } from '@/core/api'
import { numero } from '@/core/format'
import { ICONE_CLIMA } from '@/modules/diario/secoes'

export interface ClimaAtual {
  descricao: string; icone?: string; condicao: string; temp?: number; temp_min?: number; temp_max?: number; umidade?: number
  vento_ms?: number; vento?: string; nascer?: string; por?: string; local?: string; consultado_em: string
}

/** "Clima hoje" da obra pelo OpenWeather (coordenadas da obra ou cidade/UF). */
export function ClimaHoje({ obraId, compacto = false }: { obraId: number; compacto?: boolean }) {
  const q = useQuery({ queryKey: ['clima', obraId], queryFn: () => api.get<ClimaAtual>(`/clima/obra/${obraId}`), staleTime: 10 * 60_000, retry: false })
  const erro = q.error instanceof ApiError ? q.error.message : null
  const c = q.data
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="bg-gradient-to-br from-sky-50 to-white p-4 dark:from-sky-950/40 dark:to-slate-900">
        <div className="mb-2 flex items-start justify-between">
          <div><p className="font-semibold">Clima hoje</p><p className="text-xs text-slate-500">{new Date().toLocaleDateString('pt-BR')}{c?.local && ` · ${c.local}`}</p></div>
          <IconButton label="Atualizar" onClick={() => q.refetch()}>{q.isFetching ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}</IconButton>
        </div>
        {q.isLoading ? <Spinner /> : erro ? <p className="text-sm text-slate-500">{erro}</p> : c && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-5xl" aria-hidden>{ICONE_CLIMA[c.condicao] || '🌤️'}</span>
              <div><p className="text-2xl font-bold">{numero(c.temp, 1)}°</p><p className="text-sm text-slate-600 dark:text-slate-300">{c.descricao}</p></div>
            </div>
            {!compacto && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-800"><p className="text-slate-400">Mín / máx</p><b>{numero(c.temp_min, 1)}° / {numero(c.temp_max, 1)}°</b></div>
                <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-800"><p className="text-slate-400">Umidade</p><b>{numero(c.umidade, 0)}%</b></div>
                <div className="rounded-lg bg-white/70 p-2 dark:bg-slate-800"><p className="text-slate-400">Vento</p><b>{numero(c.vento_ms, 1)} m/s</b></div>
              </div>
            )}
            {!compacto && c.nascer && <p className="mt-2 flex justify-center gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Sun className="h-3.5 w-3.5 text-amber-500" />Nascer {c.nascer}</span>
              <span className="inline-flex items-center gap-1"><Moon className="h-3.5 w-3.5 text-indigo-400" />Pôr {c.por}</span></p>}
          </>
        )}
      </div>
    </Card>
  )
}
