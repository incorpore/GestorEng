import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Loading, Select, Stat } from '@/components/ui'
import { api } from '@/core/api'
import { moeda } from '@/core/format'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function Resumo() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const { data, isLoading } = useQuery({ queryKey: ['fin-resumo', ano], queryFn: () => api.get('/financeiro/resumo', { ano }) })
  const saldos = useQuery({ queryKey: ['fin-saldos'], queryFn: () => api.get('/financeiro/saldos') })
  if (isLoading || !data) return <Loading />
  const meses = data.meses.map((m: any) => ({ ...m, nome: MESES[m.mes - 1], saldo: m.receita_realizada - m.despesa_realizada }))
  const i = data.indicadores
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select className="w-32" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {Array.from({ length: 6 }, (_, k) => new Date().getFullYear() + 1 - k).map((a) => <option key={a}>{a}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="A receber" value={moeda(i.a_receber)} hint={`${moeda(i.receber_atrasado)} vencido`} />
        <Stat label="A pagar" value={moeda(i.a_pagar)} hint={`${moeda(i.pagar_atrasado)} vencido`} tone={i.pagar_atrasado > 0 ? 'alert' : undefined} />
        {(saldos.data || []).slice(0, 2).map((s: any) => <Stat key={s.id} label={`Saldo · ${s.nome}`} value={moeda(s.saldo)} />)}
      </div>
      <Card title={`Fluxo de caixa ${ano} (previsto × realizado)`}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={meses} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={44} />
              <Tooltip formatter={(v: number) => moeda(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita_prevista" name="Receita prevista" fill="#86efac" radius={[3, 3, 0, 0]} />
              <Bar dataKey="receita_realizada" name="Receita realizada" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="despesa_prevista" name="Despesa prevista" fill="#fda4af" radius={[3, 3, 0, 0]} />
              <Bar dataKey="despesa_realizada" name="Despesa realizada" fill="#e11d48" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Despesas por categoria">
          <ul className="space-y-2">
            {data.despesas_por_categoria.map((c: any) => {
              const max = data.despesas_por_categoria[0]?.valor || 1
              return (
                <li key={c.categoria} className="text-sm">
                  <div className="flex justify-between"><span>{c.categoria}</span><span className="tabular-nums">{moeda(c.valor)}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-rose-500" style={{ width: `${(c.valor / max) * 100}%` }} /></div>
                </li>
              )
            })}
            {!data.despesas_por_categoria.length && <li className="text-sm text-slate-400">Sem despesas no período.</li>}
          </ul>
        </Card>
        <Card title="Saldos das contas">
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {(saldos.data || []).map((s: any) => <li key={s.id} className="flex justify-between py-2"><span>{s.nome}</span><span className={s.saldo < 0 ? 'text-rose-600' : ''}>{moeda(s.saldo)}</span></li>)}
          </ul>
        </Card>
      </div>
    </div>
  )
}
