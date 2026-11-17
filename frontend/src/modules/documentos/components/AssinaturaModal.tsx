import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MousePointerClick, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Field, IconButton, Input, Loading, Modal, Select, Textarea, Toggle } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errMsg, useToast } from '@/core/toast'
import { PASTA_AUTO, PASTA_RAIZ, PastaDocumenso } from './PastaDocumenso'
import { type CampoPos, corAssinante, PosicoesAssinatura } from './PosicoesAssinatura'

interface Assinante { id: string; nome: string; email: string; papel: string; representante?: boolean }
interface Padrao { representante: { nome: string; email: string; cargo: string }; recentes: { nome: string; email: string }[]; pasta_auto?: string[]; nome?: string }

let seq = 0
const novoId = () => `a${++seq}`
const PAPEIS = [['SIGNER', 'Assinante'], ['APPROVER', 'Aprovador'], ['VIEWER', 'Visualizador'], ['CC', 'Cópia']]

/** Envio do PDF emitido para assinatura no Documenso. O representante legal é sempre assinante;
 *  outros podem ser adicionados e a ordem é definida arrastando os nomes. */
export function AssinaturaModal({ docId, open, onClose, onSent }: { docId: number; open: boolean; onClose: () => void; onSent: (d: any) => void }) {
  const toast = useToast()
  const { can } = useAuth()
  const sugestoes = useId()
  const padrao = useQuery({ queryKey: ['assinatura-padrao', docId], queryFn: () => api.get<Padrao>('/documentos-acoes/assinatura/padrao', { documento_id: docId }), enabled: open })
  const [rows, setRows] = useState<Assinante[]>([])
  const [msg, setMsg] = useState('')
  const [sequencial, setSequencial] = useState(true)
  const [pasta, setPasta] = useState(PASTA_AUTO)
  const [loading, setLoading] = useState(false)
  // posições de assinatura por e-mail (sobrevivem à reordenação da lista)
  const [posicoes, setPosicoes] = useState<(CampoPos & { email: string })[] | null>(null)
  const [marcando, setMarcando] = useState(false)
  const [ativo, setAtivo] = useState<string | null>(null) // e-mail de quem está sendo marcado
  const idx = (email: string) => rows.findIndex((r) => r.email.toLowerCase() === email.toLowerCase())
  const camposAtuais: (CampoPos & { email: string })[] = (posicoes || []).map((p) => ({ ...p, indice: idx(p.email) })).filter((p) => p.indice >= 0)

  const rep = padrao.data?.representante
  const repOk = !!rep?.nome && !!rep?.email
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  useEffect(() => {
    if (open && padrao.data) {
      const r = padrao.data.representante
      setRows([{ id: novoId(), nome: r.nome, email: r.email, papel: 'SIGNER', representante: true }])
    }
  }, [open, padrao.data])

  const set = (id: string, k: keyof Assinante, v: string) => setRows((rs) => rs.map((r) => {
    if (r.id !== id) return r
    const novo = { ...r, [k]: v }
    if (k === 'nome') { const s = padrao.data?.recentes.find((x) => x.nome === v); if (s && !r.email) novo.email = s.email }
    return novo
  }))
  function arrastou(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    setRows((rs) => arrayMove(rs, rs.findIndex((r) => r.id === e.active.id), rs.findIndex((r) => r.id === e.over!.id)))
  }

  async function send() {
    setLoading(true)
    try {
      const d = await api.post(`/documentos-acoes/${docId}/assinatura`, {
        assinantes: rows.map(({ nome, email, papel }) => ({ nome, email, papel })), mensagem: msg || undefined, sequencial,
        pasta_id: pasta === PASTA_AUTO || pasta === PASTA_RAIZ ? null : pasta, pasta_auto: pasta === PASTA_AUTO,
        campos: camposAtuais.length ? camposAtuais.map(({ indice, pagina, x, y, largura, altura }) => ({ indice, pagina, x, y, largura, altura })) : null })
      onSent(d)
      const aviso = d?.variaveis?._aviso_assinatura
      toast(aviso || 'Enviado para assinatura', aviso ? 'info' : undefined); onClose()
    } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar para assinatura (Documenso)" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={send} loading={loading} disabled={!repOk || rows.some((r) => !r.nome.trim() || !r.email.trim())}>Enviar</Button></>}>
      {padrao.isLoading ? <Loading /> : !repOk ? (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          O representante legal é sempre um dos assinantes. Cadastre o <b>nome</b> e o <b>e-mail do representante legal</b> em
          {' '}{can('configuracoes.editar') ? <Link to="/configuracoes" className="font-medium underline" onClick={onClose}>Configurações › Empresa</Link> : 'Configurações › Empresa (peça a um administrador)'}.
        </div>
      ) : (
        <>
          {padrao.data?.nome && <p className="mb-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">No Documenso: <b>{[...(pasta === PASTA_AUTO ? padrao.data.pasta_auto || [] : []), padrao.data.nome].join(' / ')}</b></p>}
          <p className="mb-2 text-xs text-slate-500">Arraste pelos pontinhos para mudar a ordem.{sequencial ? ' Cada pessoa recebe o documento depois que a anterior assinar.' : ''}</p>
          <datalist id={sugestoes}>{padrao.data?.recentes.map((s) => <option key={s.email} value={s.nome}>{s.email}</option>)}</datalist>
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={arrastou}>
            <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2">
                {rows.map((r, i) => <Linha key={r.id} r={r} ordem={i + 1} sugestoes={sugestoes} cargo={rep?.cargo} set={set}
                  remover={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />)}
              </ol>
            </SortableContext>
          </DndContext>
          <Button className="mt-2" size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} disabled={rows.length >= 20}
            onClick={() => setRows([...rows, { id: novoId(), nome: '', email: '', papel: 'SIGNER' }])}>Adicionar assinante</Button>
          <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Posição das assinaturas</p>
                <p className="text-xs text-slate-500">{camposAtuais.length ? `${camposAtuais.length} marcada(s). Quem não for marcado assina no rodapé da última página.` : 'Sem marcação: as assinaturas ficam lado a lado no rodapé da última página.'}</p>
              </div>
              <Button size="sm" variant="secondary" icon={<MousePointerClick className="h-4 w-4" />} disabled={rows.some((r) => !r.nome.trim() || !r.email.trim())}
                onClick={() => { setMarcando(!marcando); if (!ativo) setAtivo(rows.find((r) => r.papel === 'SIGNER')?.email || null) }}>{marcando ? 'Ocultar documento' : 'Marcar no documento'}</Button>
            </div>
            {marcando && (
              <>
                <p className="mt-2 text-xs text-slate-500">Escolha a pessoa e clique no documento sobre a linha onde ela assina. Arraste o retângulo para ajustar.</p>
                <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                  {rows.filter((r) => r.papel === 'SIGNER').map((r) => {
                    const c = camposAtuais.find((x) => x.email.toLowerCase() === r.email.toLowerCase())
                    const i = idx(r.email)
                    const sel = ativo?.toLowerCase() === r.email.toLowerCase()
                    return <li key={r.id}><button type="button" onClick={() => setAtivo(r.email)} aria-pressed={sel}
                      className="flex items-center gap-1 rounded-full border-2 px-2.5 py-1"
                      style={{ borderColor: corAssinante(i), background: sel ? `${corAssinante(i)}22` : undefined, fontWeight: sel ? 600 : 400 }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: corAssinante(i) }} />{r.nome || 'Assinante'}: {c ? `pág. ${c.pagina}` : 'não marcado'}</button></li>
                  })}
                </ul>
                <div className="mt-2"><PosicoesAssinatura docId={docId} campos={camposAtuais} nomes={rows.map((r) => r.nome)}
                  ativo={ativo ? idx(ativo) : null}
                  onChange={(cs) => {
                    const novas = cs.map((c) => ({ ...c, email: rows[c.indice].email }))
                    const marcou = novas.length > camposAtuais.length || novas.some((n) => !camposAtuais.find((c) => c.email === n.email && c.x === n.x && c.y === n.y))
                    setPosicoes(novas)
                    // depois de marcar alguém por clique, passa para a próxima pessoa ainda sem marcação
                    const proximo = rows.find((r) => r.papel === 'SIGNER' && !novas.some((n) => n.email.toLowerCase() === r.email.toLowerCase()))
                    if (marcou && novas.length > camposAtuais.length && proximo) setAtivo(proximo.email)
                  }} /></div>
              </>
            )}
          </div>
          <div className="mt-3"><PastaDocumenso value={pasta} onChange={setPasta} enabled={open} caminhoAuto={padrao.data?.pasta_auto} /></div>
          <div className="mt-3"><Toggle checked={sequencial} onChange={setSequencial} label="Assinar na ordem da lista (um após o outro)" /></div>
          <Field label="Mensagem" className="mt-3"><Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Por favor, assine o documento." /></Field>
        </>
      )}
    </Modal>
  )
}

function Linha({ r, ordem, sugestoes, cargo, set, remover }: {
  r: Assinante; ordem: number; sugestoes: string; cargo?: string; set: (id: string, k: keyof Assinante, v: string) => void; remover: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: r.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-2 rounded-lg border bg-white p-2 dark:bg-slate-900 ${isDragging ? 'z-10 border-primary shadow-lg' : 'border-slate-200 dark:border-slate-700'}`}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Mover ${r.nome || 'assinante'}`}
        className="mt-1.5 flex shrink-0 cursor-grab touch-none items-center gap-1 rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing dark:hover:bg-slate-800">
        <GripVertical className="h-5 w-5" /><span className="w-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{ordem}</span>
      </button>
      {r.representante ? (
        <div className="min-w-0 flex-1 py-1.5">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{r.nome}
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary dark:bg-primary/20"><ShieldCheck className="h-3 w-3" />Representante legal{cargo ? ` · ${cargo}` : ''}</span></p>
          <p className="truncate text-xs text-slate-500">{r.email} · assinante obrigatório</p>
        </div>
      ) : (
        <>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_130px]">
            <Input placeholder="Nome" list={sugestoes} value={r.nome} onChange={(e) => set(r.id, 'nome', e.target.value)} />
            <Input placeholder="E-mail" type="email" value={r.email} onChange={(e) => set(r.id, 'email', e.target.value)} />
            <Select value={r.papel} onChange={(e) => set(r.id, 'papel', e.target.value)}>
              {PAPEIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <IconButton label="Remover" onClick={remover}><Trash2 className="h-4 w-4" /></IconButton>
        </>
      )}
    </li>
  )
}
