import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button, Field, Modal, Textarea, Toggle } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errMsg, useToast } from '@/core/toast'

/** Redação assistida por IA (OpenRouter). Retorna HTML para o editor. */
export function AiDraftButton({ tipo, conteudo, entidade, entidadeId, onResult }: {
  tipo?: string; conteudo: string; entidade?: string | null; entidadeId?: number | null; onResult: (html: string, substituir: boolean) => void
}) {
  const { can, modules } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [instrucao, setInstrucao] = useState('')
  const [revisar, setRevisar] = useState(false)
  const [loading, setLoading] = useState(false)
  if (!modules.has('ia') || !can('ia.usar')) return null

  async function run() {
    setLoading(true)
    try {
      const r = await api.post('/ia/redigir', { instrucao, tipo, conteudo_atual: revisar ? conteudo : undefined, entidade: entidade || undefined, entidade_id: entidadeId || undefined })
      onResult(r.html, revisar)
      setOpen(false)
      toast('Texto gerado — revise antes de emitir', 'info')
    } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }

  return (
    <>
      <Button variant="secondary" icon={<Sparkles className="h-4 w-4" />} onClick={() => setOpen(true)}>Redigir com IA</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Redigir com IA" size="md"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={run} loading={loading} disabled={instrucao.length < 3}>Gerar</Button></>}>
        <Field label="O que deve ser escrito?" hint="Os dados do registro vinculado (obra, medição...) são enviados como contexto.">
          <Textarea rows={5} value={instrucao} onChange={(e) => setInstrucao(e.target.value)}
            placeholder="Ex.: Ofício à prefeitura solicitando aditivo de prazo de 60 dias devido às chuvas de outubro, citando o contrato." />
        </Field>
        <div className="mt-3"><Toggle checked={revisar} onChange={setRevisar} label="Revisar/completar o texto atual (substitui o conteúdo)" /></div>
      </Modal>
    </>
  )
}
