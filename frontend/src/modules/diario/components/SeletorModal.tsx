import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Empty, Input, Loading, Modal } from '@/components/ui'

/** Seleciona vários itens de uma lista (funcionários, máquinas, serviços do cronograma) para adicionar ao diário. */
export function SeletorModal<T extends { id: number }>({ titulo, open, onClose, carregar, chave, rotulo, detalhe, onAdicionar, jaIncluidos }: {
  titulo: string; open: boolean; onClose: () => void; carregar: () => Promise<T[]>; chave: unknown[]
  rotulo: (x: T) => string; detalhe?: (x: T) => string | null | undefined; onAdicionar: (itens: T[]) => void; jaIncluidos?: Set<number>
}) {
  const q = useQuery({ queryKey: chave, queryFn: carregar, enabled: open })
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [busca, setBusca] = useState('')
  const lista = (q.data || []).filter((x) => rotulo(x).toLowerCase().includes(busca.toLowerCase()))
  const fechar = () => { setSel(new Set()); setBusca(''); onClose() }
  return (
    <Modal open={open} onClose={fechar} title={titulo} size="md"
      footer={<><Button variant="secondary" onClick={fechar}>Cancelar</Button>
        <Button disabled={!sel.size} onClick={() => { onAdicionar((q.data || []).filter((x) => sel.has(x.id))); fechar() }}>Adicionar {sel.size || ''}</Button></>}>
      <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="mb-2" />
      {q.isLoading ? <Loading /> : !lista.length ? <Empty title="Nada encontrado" /> : (
        <ul className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {lista.map((x) => {
            const ja = jaIncluidos?.has(x.id)
            return (
              <li key={x.id}>
                <label className={`flex items-center gap-3 py-2 ${ja ? 'opacity-50' : ''}`}>
                  <input type="checkbox" disabled={ja} checked={sel.has(x.id)} onChange={(e) => {
                    const n = new Set(sel); if (e.target.checked) n.add(x.id); else n.delete(x.id); setSel(n) }} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{rotulo(x)}</span>
                    {detalhe?.(x) && <span className="block truncate text-xs text-slate-500">{detalhe(x)}</span>}</span>
                  {ja && <span className="text-xs text-slate-400">já incluído</span>}
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
