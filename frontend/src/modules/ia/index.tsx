import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import { Button, Card, PageHeader, Textarea } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'
import type { FrontModule } from '../types'

interface Msg { role: 'user' | 'assistant'; content: string }
const SUGESTOES = ['Resuma os principais pontos da Lei 14.133 sobre reajuste de contratos', 'Monte um checklist de habilitação técnica para concorrência de obras',
  'Como calcular o BDI conforme o Acórdão 2622/2013 do TCU?', 'Redija um e-mail cobrando a medição em atraso']

function Assistente() {
  const toast = useToast()
  const [msgs, setMsgs] = useState<Msg[]>(() => { try { return JSON.parse(sessionStorage.getItem('ia-chat') || '[]') } catch { return [] } })
  const [txt, setTxt] = useState('')
  const [loading, setLoading] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { sessionStorage.setItem('ia-chat', JSON.stringify(msgs)); end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(text = txt) {
    if (!text.trim()) return
    const next = [...msgs, { role: 'user' as const, content: text }]
    setMsgs(next); setTxt(''); setLoading(true)
    try { const r = await api.post('/ia/chat', { mensagens: next.slice(-20) }); setMsgs([...next, { role: 'assistant', content: r.resposta }]) }
    catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-3 md:h-[calc(100vh-6rem)]">
      <PageHeader title="Assistente IA" subtitle="Engenharia, licitações e documentos — via OpenRouter"
        actions={msgs.length > 0 && <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setMsgs([])}>Limpar</Button>} />
      <Card className="flex-1 overflow-y-auto" padded>
        {!msgs.length && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sparkles className="h-10 w-10 text-primary" />
            <div className="grid max-w-2xl gap-2 sm:grid-cols-2">
              {SUGESTOES.map((s) => <button key={s} onClick={() => send(s)} className="rounded-lg border border-slate-200 p-3 text-left text-sm hover:border-primary dark:border-slate-700">{s}</button>)}
            </div>
          </div>
        )}
        <div className="space-y-3">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{m.content}</div>
            </div>
          ))}
          {loading && <div className="text-sm text-slate-400">Pensando...</div>}
          <div ref={end} />
        </div>
      </Card>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send() }}>
        <Textarea rows={2} className="min-h-0 flex-1" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Pergunte algo..."
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <Button type="submit" loading={loading} icon={<Send className="h-4 w-4" />}>Enviar</Button>
      </form>
    </div>
  )
}

const mod: FrontModule = {
  key: 'ia', group: 'Ferramentas',
  nav: [{ label: 'Assistente IA', path: '/ia', icon: Sparkles, perm: ['ia.usar'] }],
  routes: [{ path: '/ia', element: <Assistente /> }],
}
export default mod
