import { ClimaHoje } from './ClimaHoje'
import { DadosObra } from './DadosObra'
import { IndicadoresObra } from './IndicadoresObra'
import { PendenciasObra } from './PendenciasObra'

/** Aba "Resumo" da obra. */
export function ResumoObra({ obra, resumo, onCronograma }: { obra: any; resumo: any; onCronograma: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ClimaHoje obraId={obra.id} />
        <PendenciasObra pendencias={resumo.pendencias} />
      </div>
      <IndicadoresObra obra={obra} resumo={resumo} onCronograma={onCronograma} />
      <DadosObra obra={obra} />
    </div>
  )
}
