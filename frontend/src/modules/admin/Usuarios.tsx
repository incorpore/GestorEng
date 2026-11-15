import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { KeyRound, Plus, ShieldOff, Unlock } from 'lucide-react'
import { Badge, Button, Card, Field, IconButton, Input, Loading, Modal, Toggle } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { dataHora } from '@/core/format'
import { errMsg, useToast } from '@/core/toast'
import { UsuarioForm } from './components/UsuarioForm'

export function Usuarios() {
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const [q, setQ] = useState('')
  const [ed, setEd] = useState<number | null | undefined>(undefined)
  const [senha, setSenha] = useState<{ id: number; nova: string; exigir: boolean } | null>(null)
  const list = useQuery({ queryKey: ['/usuarios', q], queryFn: () => api.get('/usuarios', { q, page_size: 200 }) })
  const reload = () => qc.invalidateQueries({ queryKey: ['/usuarios'] })
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload() } catch (e) { toast(errMsg(e), 'error') } }

  return (
    <>
      <div className="mb-3 flex gap-2">
        <Input placeholder="Buscar usuário..." value={q} onChange={(e) => setQ(e.target.value)} />
        {can('usuarios.criar') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEd(null)}>Novo</Button>}
      </div>
      <Card padded={false}>
        {list.isLoading ? <Loading /> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.data?.items.map((u: any) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => can('usuarios.editar') && setEd(u.id)}>
                  <p className="font-medium">{u.nome} {u.superusuario && <Badge tone="purple">Admin</Badge>} {!u.ativo && <Badge tone="red">Inativo</Badge>} {u.totp_ativo && <Badge tone="green">2FA</Badge>}</p>
                  <p className="text-xs text-slate-500">{u.email} · {u.perfis.map((p: any) => p.nome).join(', ') || 'sem perfil'} · último acesso {dataHora(u.ultimo_login)}</p>
                </button>
                {can('usuarios.editar') && <div className="flex gap-1">
                  {u.bloqueado_ate && <IconButton label="Desbloquear" onClick={() => act(() => api.post(`/usuarios/${u.id}/desbloquear`), 'Desbloqueado')}><Unlock className="h-4 w-4" /></IconButton>}
                  {u.totp_ativo && <IconButton label="Resetar 2FA" onClick={() => act(() => api.post(`/usuarios/${u.id}/2fa/resetar`), '2FA resetado')}><ShieldOff className="h-4 w-4" /></IconButton>}
                  <IconButton label="Redefinir senha" onClick={() => setSenha({ id: u.id, nova: '', exigir: true })}><KeyRound className="h-4 w-4" /></IconButton>
                </div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {ed !== undefined && <UsuarioForm id={ed} onClose={() => setEd(undefined)} onSaved={() => { setEd(undefined); reload() }} />}
      {senha && (
        <Modal open onClose={() => setSenha(null)} title="Redefinir senha" size="sm"
          footer={<Button onClick={() => act(() => api.post(`/usuarios/${senha.id}/senha`, { nova_senha: senha.nova, exigir_troca: senha.exigir }), 'Senha redefinida').then(() => setSenha(null))}>Salvar</Button>}>
          <Field label="Nova senha"><Input type="password" autoComplete="new-password" value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} /></Field>
          <div className="mt-3"><Toggle checked={senha.exigir} onChange={(x) => setSenha({ ...senha, exigir: x })} label="Exigir troca no próximo acesso" /></div>
          <p className="mt-2 text-xs text-slate-500">Todas as sessões do usuário serão encerradas.</p>
        </Modal>
      )}
    </>
  )
}
