import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Card, Empty, Loading } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { data, moeda } from '@/core/format'
import { medicaoStatus } from '../config'
import { MedicaoEditor } from '../MedicaoEditor'

/** Aba "Medições": boletins da obra e editor de medição. */
export function MedicoesObra({ obraId }: { obraId: number }) {
  const qc = useQueryClient()
  const { can } = useAuth()
  const [med, setMed] = useState<any | null | undefined>(undefined)
  const medicoes = useQuery({ queryKey: ['/medicoes', { obra_id: obraId }], queryFn: () => api.get('/medicoes', { obra_id: obraId, page_size: 200 }) })
  return (
    <>
      <Card title="Boletins de medição" padded={false} actions={can('obras.criar') && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setMed(null)}>Nova medição</Button>}>
        {medicoes.isLoading ? <Loading /> : !medicoes.data?.items.length ? <Empty title="Nenhuma medição" text="A primeira medição é sugerida a partir do orçamento aprovado da obra." /> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {medicoes.data.items.map((m: any) => (
              <li key={m.id}>
                <button className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => setMed(m)}>
                  <div>
                    <p className="font-medium">Medição nº {m.numero} {medicaoStatus(m.status)}</p>
                    <p className="text-xs text-slate-500">{data(m.periodo_inicio)} a {data(m.periodo_fim)} · {m.itens.length} itens</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{moeda(m.valor_periodo)}</p>
                    <p className="text-xs text-slate-500">acumulado {moeda(m.valor_acumulado)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {med !== undefined && <MedicaoEditor obraId={obraId} medicao={med} onClose={() => setMed(undefined)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['/medicoes'] }); qc.invalidateQueries({ queryKey: ['obra-resumo', obraId] }) }} />}
    </>
  )
}
