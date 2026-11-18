import { Stat } from '@/components/ui'
import { moeda } from '@/core/format'

/** Números do contrato (valor, medido, saldo, avanço) e do financeiro da obra. */
export function IndicadoresObra({ obra: o, resumo: r, onCronograma }: { obra: any; resumo: any; onCronograma: () => void }) {
  const saldoContrato = Number(o.valor_total || 0) - Number(r.medido_acumulado || 0)
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Valor do contrato" value={moeda(o.valor_total)} hint={Number(o.valor_aditivos) ? `inclui ${moeda(o.valor_aditivos)} de aditivos` : undefined} />
        <Stat label="Medido acumulado" value={moeda(r.medido_acumulado)} hint={`${r.medicoes ?? 0} medição(ões)`} />
        <Stat label="Saldo contratual" value={moeda(saldoContrato)} />
        <Stat label="Avanço físico" value={`${Number(r.avanco_cronograma ?? o.progresso ?? 0).toFixed(1)}%`} hint={r.avanco_cronograma != null ? 'pelo cronograma' : undefined} onClick={onCronograma} />
      </div>
      {r.financeiro && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Receitas recebidas" value={moeda(r.financeiro.receita_pago || 0)} />
          <Stat label="Receitas a receber" value={moeda((r.financeiro.receita_aberto || 0) + (r.financeiro.receita_parcial || 0))} />
          <Stat label="Despesas pagas" value={moeda(r.financeiro.despesa_pago || 0)} />
          <Stat label="Resultado (realizado)" value={moeda((r.financeiro.receita_pago || 0) - (r.financeiro.despesa_pago || 0))} />
        </div>
      )}
    </>
  )
}
