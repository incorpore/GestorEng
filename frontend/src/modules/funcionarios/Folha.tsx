import { useState } from 'react'
import { Banknote, Search } from 'lucide-react'
import { Badge, Button, Card, Empty, Field, Input, Loading } from '@/components/ui'
import { RelationSelect } from '@/components/resource/RelationSelect'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { hoje, moeda, numero } from '@/core/format'
import { label, VINCULO } from '@/core/options'
import { errMsg, useToast } from '@/core/toast'

const inicioMes = () => hoje().slice(0, 8) + '01'

/** Resumo de pagamentos por período a partir dos apontamentos + baixa em lote no financeiro. */
export function Folha() {
  const { can } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ inicio: inicioMes(), fim: hoje(), obra_id: null as number | null })
  const [res, setRes] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState<number | null>(null)

  async function buscar() {
    setLoading(true)
    try { setRes(await api.post('/funcionarios-relatorios/folha', f)) } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }

  async function pagar(fid: number) {
    setPaying(fid)
    try {
      const ap = await api.get('/apontamentos', { funcionario_id: fid, pago: false, data__gte: f.inicio, data__lte: f.fim, obra_id: f.obra_id || undefined, page_size: 500 })
      const r = await api.post('/funcionarios-relatorios/pagar', { apontamentos_ids: ap.items.map((a: any) => a.id), data_pagamento: hoje(), gerar_lancamento: can('financeiro.criar') })
      toast(`${r.pagos} apontamento(s) pagos${r.lancamentos.length ? ' e lançados no financeiro' : ''}`)
      buscar()
    } catch (e) { toast(errMsg(e), 'error') } finally { setPaying(null) }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="De"><Input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Field>
          <Field label="Até"><Input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Field>
          <Field label="Obra"><RelationSelect endpoint="/obras" value={f.obra_id} onChange={(v) => setF({ ...f, obra_id: v })} placeholder="Todas" /></Field>
          <div className="flex items-end"><Button className="w-full" icon={<Search className="h-4 w-4" />} onClick={buscar} loading={loading}>Calcular</Button></div>
        </div>
      </Card>
      {loading ? <Loading /> : res && (
        <Card padded={false} title={`Total ${moeda(res.total)} · a pagar ${moeda(res.a_pagar)}`}>
          {!res.linhas.length ? <Empty title="Sem apontamentos no período" /> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Funcionário</th><th>Vínculo</th><th className="text-right">Diárias</th><th className="text-right">Horas</th><th className="text-right">HE</th><th className="text-right">Produção</th><th className="text-right">Total</th><th className="text-right">A pagar</th><th>PIX</th><th /></tr></thead>
                <tbody>
                  {res.linhas.map((l: any) => (
                    <tr key={l.funcionario_id}>
                      <td className="font-medium">{l.nome}</td><td><Badge>{label(VINCULO, l.vinculo)}</Badge></td>
                      <td className="text-right">{numero(l.diarias)}</td><td className="text-right">{numero(l.horas)}</td><td className="text-right">{numero(l.horas_extras)}</td>
                      <td className="text-right">{numero(l.quantidade)}</td><td className="text-right">{moeda(l.valor)}</td>
                      <td className="text-right font-semibold">{moeda(l.a_pagar)}</td><td className="text-xs">{l.pix || '—'}</td>
                      <td>{l.a_pagar > 0 && can('apontamentos.editar') && <Button size="sm" variant="success" icon={<Banknote className="h-3.5 w-3.5" />} loading={paying === l.funcionario_id} onClick={() => pagar(l.funcionario_id)}>Pagar</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
