import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Tabs, Toggle } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errMsg, useToast } from '@/core/toast'
import { ObrasPicker } from './ObrasPicker'
import { PermissoesDiretas } from './PermissoesDiretas'

export function UsuarioForm({ id, onClose, onSaved }: { id: number | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const { user } = useAuth()
  const perfis = useQuery({ queryKey: ['/perfis'], queryFn: () => api.get('/perfis') })
  const [tab, setTab] = useState<'dados' | 'acesso' | 'obras' | 'extra'>('dados')
  const [v, setV] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id) api.get(`/usuarios/${id}`).then((u) => setV({ ...u, perfis_ids: u.perfis.map((p: any) => p.id) }))
    else setV({ nome: '', email: '', senha: '', ativo: true, superusuario: false, perfis_ids: [], obras_restritas: false, obras_ids: [], permissoes_diretas: [] })
  }, [id])
  if (!v) return null
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))

  async function save() {
    setSaving(true)
    try {
      const body: any = { nome: v.nome, email: v.email, ativo: v.ativo, telefone: v.telefone || null, cargo: v.cargo || null, perfis_ids: v.perfis_ids,
        obras_restritas: v.obras_restritas, obras_ids: v.obras_ids, permissoes_diretas: v.permissoes_diretas }
      if (user?.superusuario) body.superusuario = v.superusuario
      if (id) await api.patch(`/usuarios/${id}`, body)
      else await api.post('/usuarios', { ...body, senha: v.senha, superusuario: !!v.superusuario })
      toast('Usuário salvo'); onSaved()
    } catch (e) { toast(errMsg(e), 'error') } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={id ? v.nome : 'Novo usuário'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>Salvar</Button></>}>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'dados', label: 'Dados' }, { key: 'acesso', label: 'Perfis' }, { key: 'obras', label: 'Obras' }, { key: 'extra', label: 'Exceções' }]} />
      <div className="pt-4">
        {tab === 'dados' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" required><Input value={v.nome} onChange={(e) => set('nome', e.target.value)} /></Field>
            <Field label="E-mail" required><Input type="email" value={v.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Cargo"><Input value={v.cargo || ''} onChange={(e) => set('cargo', e.target.value)} /></Field>
            <Field label="Telefone"><Input value={v.telefone || ''} onChange={(e) => set('telefone', e.target.value)} /></Field>
            {!id && <Field label="Senha inicial" required hint="Mín. 10 caracteres com maiúsculas, minúsculas, números ou símbolos. Será exigida a troca no 1º acesso.">
              <Input type="password" autoComplete="new-password" value={v.senha} onChange={(e) => set('senha', e.target.value)} /></Field>}
            <div className="flex flex-col gap-2 pt-5">
              <Toggle checked={v.ativo} onChange={(x) => set('ativo', x)} label="Ativo" />
              {user?.superusuario && <Toggle checked={v.superusuario} onChange={(x) => set('superusuario', x)} label="Administrador (acesso total)" />}
            </div>
          </div>
        )}
        {tab === 'acesso' && (
          <div className="space-y-2">
            {perfis.data?.map((p: any) => (
              <label key={p.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <input type="checkbox" className="mt-1" checked={v.perfis_ids.includes(p.id)}
                  onChange={(e) => set('perfis_ids', e.target.checked ? [...v.perfis_ids, p.id] : v.perfis_ids.filter((x: number) => x !== p.id))} />
                <span><span className="font-medium">{p.nome}</span><span className="block text-xs text-slate-500">{p.descricao}</span></span>
              </label>
            ))}
          </div>
        )}
        {tab === 'obras' && <ObrasPicker restrito={v.obras_restritas} ids={v.obras_ids} onChange={(r, ids) => { set('obras_restritas', r); set('obras_ids', ids) }} />}
        {tab === 'extra' && <PermissoesDiretas value={v.permissoes_diretas} onChange={(x) => set('permissoes_diretas', x)} />}
      </div>
    </Modal>
  )
}
