import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, Empty, Field, Input, Loading, Toggle } from '@/components/ui'
import { RelationSelect } from '@/components/resource/RelationSelect'
import { api } from '@/core/api'
import { moeda, numero } from '@/core/format'

export function Saldos() {
  const [f, setF] = useState({ local_id: null as number | null, abaixo_minimo: false, q: '' })
  const q = useQuery({ queryKey: ['estoque-saldos', f], queryFn: () => api.get('/estoque/saldos', { ...f, local_id: f.local_id || undefined }) })
  const total = (q.data || []).reduce((a: number, s: any) => a + s.valor, 0)
  return (
    <Card padded={false}>
      <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-3 dark:border-slate-800 sm:grid-cols-3">
        <Input placeholder="Buscar item..." value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <Field label=""><RelationSelect endpoint="/locais-estoque" value={f.local_id} onChange={(v) => setF({ ...f, local_id: v })} placeholder="Todos os locais" /></Field>
        <div className="flex items-center"><Toggle checked={f.abaixo_minimo} onChange={(v) => setF({ ...f, abaixo_minimo: v })} label="Somente abaixo do mínimo" /></div>
      </div>
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title="Sem saldo" text="Registre entradas para formar o estoque." /> : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Item</th><th>Local</th><th className="text-right">Saldo</th><th className="text-right">Mínimo</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {q.data.map((s: any) => (
                <tr key={`${s.item_id}-${s.local_id}`}>
                  <td className="font-medium">{s.saldo < s.estoque_minimo && <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />}{s.nome} <span className="text-xs text-slate-400">{s.codigo}</span></td>
                  <td>{s.local}</td><td className="text-right tabular-nums">{numero(s.saldo)} {s.unidade}</td>
                  <td className="text-right tabular-nums text-slate-500">{numero(s.estoque_minimo)}</td><td className="text-right tabular-nums">{moeda(s.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={4} className="text-right font-semibold">Valor em estoque</td><td className="text-right font-semibold">{moeda(total)}</td></tr></tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}
