import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'

interface Lista { lista: string; rotulo: string; valores: string[]; pode_adicionar: boolean }

export const useLista = (nome: string) =>
  useQuery({ queryKey: ['lista', nome], queryFn: () => api.get<Lista>(`/listas/${nome}`), staleTime: 5 * 60_000 })

/** Lista suspensa editável: valores padrão + adicionados pelos usuários; "+" abre pop-up para incluir um novo. */
export function ListaSelect({ lista, value, onChange, disabled, vazio = '—' }: {
  lista: string; value: string | null | undefined; onChange: (v: string | null) => void; disabled?: boolean; vazio?: string
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data } = useLista(lista)
  const [aberto, setAberto] = useState(false)
  const [novo, setNovo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const valores = data?.valores || []
  const opcoes = value && !valores.includes(value) ? [value, ...valores] : valores

  async function adicionar() {
    setSalvando(true)
    try {
      const r = await api.post(`/listas/${lista}`, { valor: novo })
      await qc.invalidateQueries({ queryKey: ['lista', lista] })
      onChange(r.valor)
      toast(r.novo ? `"${r.valor}" adicionado à lista` : `"${r.valor}" já existia e foi selecionado`)
      setAberto(false); setNovo('')
    } catch (e) { toast(errMsg(e), 'error') } finally { setSalvando(false) }
  }

  return (
    <div className="flex gap-1">
      <Select disabled={disabled} value={value ?? ''} className="min-w-0 flex-1"
        onChange={(e) => (e.target.value === '__novo__' ? setAberto(true) : onChange(e.target.value || null))}>
        <option value="">{vazio}</option>
        {opcoes.map((v) => <option key={v} value={v}>{v}</option>)}
        {data?.pode_adicionar && <option value="__novo__">+ Adicionar novo...</option>}
      </Select>
      {data?.pode_adicionar && !disabled && (
        <button type="button" title={`Adicionar em ${data.rotulo}`} aria-label="Adicionar item à lista" onClick={() => setAberto(true)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-primary hover:bg-primary-50 dark:border-slate-700">
          <Plus className="h-4 w-4" />
        </button>
      )}
      <Modal open={aberto} onClose={() => setAberto(false)} title={`Adicionar — ${data?.rotulo || ''}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setAberto(false)}>Cancelar</Button><Button onClick={adicionar} loading={salvando} disabled={!novo.trim()}>Adicionar</Button></>}>
        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); if (novo.trim()) adicionar() }}>
          <Field label="Novo item"><Input autoFocus value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={120} /></Field>
          <p className="mt-2 text-xs text-slate-500">Ficará disponível para todos os usuários. Itens podem ser removidos em Configurações › Listas.</p>
        </form>
      </Modal>
    </div>
  )
}
