import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, Card, Input, Loading, useConfirm } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errMsg, useToast } from '@/core/toast'

interface ListaInfo { lista: string; rotulo: string; padrao: string[]; personalizados: { id: number; valor: string }[]; pode_adicionar: boolean }

/** Listas suspensas editáveis: padrões do sistema (fixos) + itens adicionados pelos usuários (removíveis). */
export function Listas() {
  const { data, isLoading } = useQuery({ queryKey: ['listas'], queryFn: () => api.get<ListaInfo[]>('/listas') })
  if (isLoading || !data) return <Loading />
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.map((l) => <CardLista key={l.lista} l={l} />)}
    </div>
  )
}

function CardLista({ l }: { l: ListaInfo }) {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { can } = useAuth()
  const [novo, setNovo] = useState('')
  const recarregar = () => Promise.all([qc.invalidateQueries({ queryKey: ['listas'] }), qc.invalidateQueries({ queryKey: ['lista', l.lista] })])

  async function adicionar() {
    try { await api.post(`/listas/${l.lista}`, { valor: novo }); setNovo(''); await recarregar() } catch (e) { toast(errMsg(e), 'error') }
  }
  async function remover(id: number, valor: string) {
    if (!(await confirm(`Remover "${valor}" da lista? Registros que já usam esse valor não são alterados.`, { title: 'Remover item', danger: true, ok: 'Remover' }))) return
    try { await api.del(`/listas/${l.lista}/${id}`); await recarregar() } catch (e) { toast(errMsg(e), 'error') }
  }

  return (
    <Card title={l.rotulo}>
      <div className="flex flex-wrap gap-1.5">
        {l.padrao.map((v) => <span key={v} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{v}</span>)}
        {l.personalizados.map((o) => (
          <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary dark:bg-primary/20">
            {o.valor}
            {can('configuracoes.editar') && <button type="button" aria-label={`Remover ${o.valor}`} onClick={() => remover(o.id, o.valor)} className="hover:text-red-600"><X className="h-3 w-3" /></button>}
          </span>
        ))}
      </div>
      {l.pode_adicionar && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (novo.trim()) adicionar() }}>
          <Input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo item" maxLength={120} />
          <Button type="submit" variant="secondary" disabled={!novo.trim()}><Plus className="h-4 w-4" />Adicionar</Button>
        </form>
      )}
      <p className="mt-2 text-xs text-slate-500">Cinza: padrão do sistema. Destacados: adicionados pelos usuários.</p>
    </Card>
  )
}
