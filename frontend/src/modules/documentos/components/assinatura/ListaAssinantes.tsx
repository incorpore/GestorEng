import { useId } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { LinhaAssinante } from './LinhaAssinante'
import { type Assinante, novoId, type Recente } from './tipos'

/** Lista de quem assina: arrastar muda a ordem; sugere nomes de quem já assinou antes. */
export function ListaAssinantes({ rows, onChange, recentes, cargo, sequencial }: {
  rows: Assinante[]; onChange: (r: Assinante[] | ((r: Assinante[]) => Assinante[])) => void; recentes: Recente[]; cargo?: string; sequencial: boolean
}) {
  const sugestoes = useId()
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const set = (id: string, k: keyof Assinante, v: string) => onChange((rs) => rs.map((r) => {
    if (r.id !== id) return r
    const novo = { ...r, [k]: v }
    if (k === 'nome') { const s = recentes.find((x) => x.nome === v); if (s && !r.email) novo.email = s.email }
    return novo
  }))
  function arrastou(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    onChange((rs) => arrayMove(rs, rs.findIndex((r) => r.id === e.active.id), rs.findIndex((r) => r.id === e.over!.id)))
  }

  return (
    <>
      <p className="mb-2 text-xs text-slate-500">Arraste pelos pontinhos para mudar a ordem.{sequencial ? ' Cada pessoa recebe o documento depois que a anterior assinar.' : ''}</p>
      <datalist id={sugestoes}>{recentes.map((s) => <option key={s.email} value={s.nome}>{s.email}</option>)}</datalist>
      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={arrastou}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {rows.map((r, i) => <LinhaAssinante key={r.id} r={r} ordem={i + 1} sugestoes={sugestoes} cargo={cargo} set={set}
              remover={() => onChange((rs) => rs.filter((x) => x.id !== r.id))} />)}
          </ol>
        </SortableContext>
      </DndContext>
      <Button className="mt-2" size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} disabled={rows.length >= 20}
        onClick={() => onChange([...rows, { id: novoId(), nome: '', email: '', papel: 'SIGNER' }])}>Adicionar assinante</Button>
    </>
  )
}
