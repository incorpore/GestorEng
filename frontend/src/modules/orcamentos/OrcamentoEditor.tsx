import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, FileText, Save } from 'lucide-react'
import { Button, Loading, PageHeader } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { hoje } from '@/core/format'
import { errMsg, useToast } from '@/core/toast'
import { CAMPOS, OrcamentoCabecalho } from './components/OrcamentoCabecalho'
import { OrcamentoItens } from './components/OrcamentoItens'
import { OrcamentoTotais } from './components/OrcamentoTotais'

export default function OrcamentoEditor() {
  const { id } = useParams()
  const isNew = id === 'novo'
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const q = useQuery({ queryKey: ['/orcamentos', id], queryFn: () => api.get(`/orcamentos/${id}`), enabled: !isNew })
  const [v, setV] = useState<any>(isNew ? { titulo: '', status: 'rascunho', data: hoje(), bdi: 0, desconto: 0, itens: [] } : null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (q.data) setV(q.data) }, [q.data])
  if (!v) return <Loading />
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))

  async function save() {
    setSaving(true)
    try {
      const body: any = {}
      CAMPOS.forEach((f) => (body[f.name] = v[f.name] === '' ? null : v[f.name] ?? null))
      body.bdi = v.bdi || 0
      body.desconto = v.desconto || 0
      body.itens = (v.itens || []).map((i: any, k: number) => ({ ordem: k, item: i.item || null, agrupador: !!i.agrupador, fonte: i.fonte || null, codigo: i.codigo || null,
        descricao: i.descricao || '-', unidade: i.unidade || null, quantidade: i.quantidade || 0, preco_unitario: i.preco_unitario || 0 }))
      const r = isNew ? await api.post('/orcamentos', body) : await api.patch(`/orcamentos/${id}`, body)
      qc.invalidateQueries({ queryKey: ['/orcamentos'] })
      toast('Orçamento salvo')
      if (isNew) nav(`/orcamentos/${r.id}`, { replace: true })
      else setV(r)
      return r
    } catch (e) { toast(errMsg(e), 'error') } finally { setSaving(false) }
  }

  async function proposta() {
    const o = await save()
    if (!o) return
    try {
      const m = await api.get('/modelos-documento', { tipo: 'proposta' })
      const d = await api.post('/documentos-acoes/gerar', { modelo_id: m.items[0]?.id, titulo: `Proposta ${o.numero} — ${o.titulo}`, entidade: 'orcamento', entidade_id: o.id })
      nav(`/documentos/${d.id}`)
    } catch (e) { toast(errMsg(e), 'error') }
  }

  async function duplicar() {
    try { const d = await api.post(`/orcamentos-acoes/${id}/duplicar`); nav(`/orcamentos/${d.id}`); toast('Orçamento duplicado') } catch (e) { toast(errMsg(e), 'error') }
  }

  return (
    <div className="space-y-4">
      <PageHeader back={() => nav('/orcamentos')} title={isNew ? 'Novo orçamento' : v.titulo} subtitle={v.numero}
        actions={<>
          {!isNew && can('orcamentos.criar') && <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={duplicar}>Duplicar</Button>}
          {can('documentos.criar') && <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={proposta}>Gerar proposta</Button>}
          <Button icon={<Save className="h-4 w-4" />} onClick={save} loading={saving}>Salvar</Button>
        </>} />
      <OrcamentoCabecalho v={v} set={set} />
      <OrcamentoTotais v={v} />
      <OrcamentoItens itens={v.itens || []} onChange={(r) => set('itens', r)} />
    </div>
  )
}
