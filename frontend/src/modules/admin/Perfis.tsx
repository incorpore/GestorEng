import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Shield, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Field, IconButton, Input, Loading, Modal, Textarea, useConfirm } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errMsg, useToast } from '@/core/toast'
import { PermissoesEditor } from './components/PermissoesEditor'

export function Perfis() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { can } = useAuth()
  const q = useQuery({ queryKey: ['/perfis'], queryFn: () => api.get('/perfis') })
  const [ed, setEd] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const body = { nome: ed.nome, descricao: ed.descricao, permissoes: ed.permissoes }
      ed.id ? await api.patch(`/perfis/${ed.id}`, body) : await api.post('/perfis', body)
      toast('Perfil salvo'); setEd(null); qc.invalidateQueries({ queryKey: ['/perfis'] })
    } catch (e) { toast(errMsg(e), 'error') } finally { setSaving(false) }
  }

  if (q.isLoading) return <Loading />
  return (
    <>
      <div className="mb-3 flex justify-end">{can('perfis.criar') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEd({ nome: '', descricao: '', permissoes: [] })}>Novo perfil</Button>}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {q.data.map((p: any) => (
          <Card key={p.id}>
            <button className="w-full text-left" onClick={() => can('perfis.editar') && setEd({ ...p })}>
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><span className="font-semibold">{p.nome}</span>{p.sistema && <Badge>padrão</Badge>}</div>
              <p className="mt-1 text-sm text-slate-500">{p.descricao}</p>
              <p className="mt-2 text-xs text-slate-400">{p.permissoes.length} permissões</p>
            </button>
            {!p.sistema && can('perfis.excluir') && <div className="mt-2 flex justify-end"><IconButton label="Excluir" onClick={async () => {
              if (await confirm(`Excluir o perfil ${p.nome}?`, { danger: true })) { try { await api.del(`/perfis/${p.id}`); qc.invalidateQueries({ queryKey: ['/perfis'] }) } catch (e) { toast(errMsg(e), 'error') } }
            }}><Trash2 className="h-4 w-4" /></IconButton></div>}
          </Card>
        ))}
      </div>
      {ed && (
        <Modal open onClose={() => setEd(null)} title={ed.id ? `Perfil: ${ed.nome}` : 'Novo perfil'} size="xl"
          footer={<><Button variant="secondary" onClick={() => setEd(null)}>Cancelar</Button><Button onClick={save} loading={saving}>Salvar</Button></>}>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nome" required><Input value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Field>
            <Field label="Descrição"><Textarea rows={1} value={ed.descricao || ''} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} /></Field>
          </div>
          <PermissoesEditor value={ed.permissoes} onChange={(permissoes) => setEd({ ...ed, permissoes })} />
        </Modal>
      )}
    </>
  )
}
