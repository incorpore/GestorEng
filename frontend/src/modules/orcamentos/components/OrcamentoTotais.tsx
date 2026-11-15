import { moeda } from '@/core/format'
import { totais } from './OrcamentoItens'

export function OrcamentoTotais({ v }: { v: any }) {
  const t = totais(v)
  return (
    <div className="card grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
      <div><p className="text-xs text-slate-500">Custo direto</p><p className="font-semibold">{moeda(t.cd)}</p></div>
      <div><p className="text-xs text-slate-500">BDI ({Number(v.bdi || 0)}%)</p><p className="font-semibold">{moeda(t.bdi)}</p></div>
      <div><p className="text-xs text-slate-500">Desconto</p><p className="font-semibold">-{moeda(t.desc)}</p></div>
      <div><p className="text-xs text-slate-500">Total geral</p><p className="text-lg font-bold text-primary">{moeda(t.total)}</p></div>
    </div>
  )
}
