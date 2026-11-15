import { useState } from 'react'
import { Button, Card, Field, Input } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errMsg, useToast } from '@/core/toast'

export function TrocarSenha({ onDone }: { onDone?: () => void }) {
  const toast = useToast()
  const { applyTokens, reload } = useAuth()
  const [v, setV] = useState({ atual: '', nova: '', conf: '' })
  const [loading, setLoading] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (v.nova !== v.conf) return toast('As senhas não conferem', 'error')
    setLoading(true)
    try { await applyTokens(await api.post('/auth/trocar-senha', { senha_atual: v.atual, nova_senha: v.nova })); await reload(); toast('Senha alterada'); setV({ atual: '', nova: '', conf: '' }); onDone?.() }
    catch (err) { toast(errMsg(err), 'error') } finally { setLoading(false) }
  }
  return (
    <Card title="Alterar senha">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <Field label="Senha atual"><Input type="password" autoComplete="current-password" required value={v.atual} onChange={(e) => setV({ ...v, atual: e.target.value })} /></Field>
        <Field label="Nova senha" hint="Mín. 10 caracteres, 3 tipos"><Input type="password" autoComplete="new-password" required value={v.nova} onChange={(e) => setV({ ...v, nova: e.target.value })} /></Field>
        <Field label="Confirmar"><Input type="password" autoComplete="new-password" required value={v.conf} onChange={(e) => setV({ ...v, conf: e.target.value })} /></Field>
        <div className="sm:col-span-3"><Button type="submit" loading={loading}>Alterar senha</Button></div>
      </form>
    </Card>
  )
}
