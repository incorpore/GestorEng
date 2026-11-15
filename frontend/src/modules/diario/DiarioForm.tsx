import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Copy, FileText, Lock, Plus, Trash2, Unlock } from 'lucide-react'
import { Badge, Button, Card, Field, IconButton, Input, Loading, PageHeader, Select, Textarea } from '@/components/ui'
import { Attachments } from '@/components/resource/Attachments'
import { RelationSelect } from '@/components/resource/RelationSelect'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { hoje } from '@/core/format'
import { CLIMA } from '@/core/options'
import { errMsg, useToast } from '@/core/toast'

const SITUACAO = [
  { value: 'iniciada', label: 'Iniciada' }, { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' }, { value: 'paralisada', label: 'Paralisada' },
]

function ListEditor({ title, rows, onChange, cols, newRow, disabled }: {
  title: string; rows: any[]; onChange: (r: any[]) => void; disabled?: boolean
  cols: { key: string; label: string; type?: 'number' | 'select'; options?: { value: string; label: string }[]; grow?: boolean }[]; newRow: () => any
}) {
  return (
    <Card title={title} actions={!disabled && <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...rows, newRow()])}>Adicionar</Button>}>
      {!rows.length ? <p className="text-sm text-slate-400">Nenhum registro.</p> : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 p-2 dark:border-slate-800 sm:flex-nowrap sm:border-0 sm:p-0">
              {cols.map((c) => (
                <Field key={c.key} label={c.label} className={c.grow ? 'min-w-[180px] flex-1' : 'w-28'}>
                  {c.type === 'select' ? (
                    <Select disabled={disabled} value={r[c.key] ?? ''} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.key]: e.target.value } : x)))}>
                      {c.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : (
                    <Input disabled={disabled} type={c.type === 'number' ? 'number' : 'text'} inputMode={c.type === 'number' ? 'decimal' : undefined} value={r[c.key] ?? ''}
                      onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.key]: c.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value } : x)))} />
                  )}
                </Field>
              ))}
              {!disabled && <IconButton label="Remover" className="mb-0.5 hover:text-rose-600" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></IconButton>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function DiarioForm() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const isNew = id === 'novo'
  const [v, setV] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const q = useQuery({ queryKey: ['/diarios', id], queryFn: () => api.get(`/diarios/${id}`), enabled: !isNew })

  useEffect(() => {
    if (isNew) setV({ obra_id: sp.get('obra') ? Number(sp.get('obra')) : null, data: hoje(), clima_manha: 'bom', clima_tarde: 'bom', clima_noite: null,
      condicao: 'praticavel', efetivo: [], equipamentos: [], atividades: [] })
    else if (q.data) setV(q.data)
  }, [isNew, q.data, sp])

  if (!v) return <Loading />
  const fechado = v.status === 'fechado'
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  const readOnly = fechado || (!isNew && !can('diario.editar'))

  async function copiarAnterior() {
    if (!v.obra_id) return toast('Selecione a obra', 'error')
    const m = await api.get('/diarios-acoes/modelo', { obra_id: v.obra_id })
    if (!m.efetivo) return toast('Não há diário anterior nesta obra', 'info')
    setV((s: any) => ({ ...s, ...m }))
    toast('Efetivo, equipamentos e atividades em andamento copiados')
  }

  async function save() {
    setSaving(true)
    try {
      const fields = ['obra_id', 'data', 'clima_manha', 'clima_tarde', 'clima_noite', 'condicao', 'temperatura', 'efetivo', 'equipamentos', 'atividades',
        'materiais_recebidos', 'ocorrencias', 'visitas', 'observacoes', 'responsavel']
      const body: any = {}
      fields.forEach((f) => (body[f] = v[f] === '' ? null : v[f]))
      body.efetivo = (v.efetivo || []).filter((e: any) => e.funcao).map((e: any) => ({ ...e, quantidade: Number(e.quantidade || 0) }))
      body.equipamentos = (v.equipamentos || []).filter((e: any) => e.descricao)
      body.atividades = (v.atividades || []).filter((e: any) => e.descricao)
      const saved = isNew ? await api.post('/diarios', body) : await api.patch(`/diarios/${id}`, body)
      toast('Diário salvo')
      qc.invalidateQueries({ queryKey: ['/diarios'] })
      if (isNew) nav(`/diario/${saved.id}`, { replace: true })
      else setV(saved)
    } catch (e) { toast(errMsg(e), 'error') } finally { setSaving(false) }
  }

  async function acao(a: 'fechar' | 'reabrir') {
    try { setV(await api.post(`/diarios-acoes/${id}/${a}`)); toast(a === 'fechar' ? 'Diário fechado' : 'Diário reaberto'); qc.invalidateQueries({ queryKey: ['/diarios'] }) }
    catch (e) { toast(errMsg(e), 'error') }
  }

  async function gerarRDO() {
    try {
      const modelos = await api.get('/modelos-documento', { tipo: 'relatorio', entidade: 'diario' })
      const doc = await api.post('/documentos-acoes/gerar', { modelo_id: modelos.items[0]?.id, tipo: 'relatorio', titulo: `RDO nº ${v.numero} — ${v.obra_nome}`,
        entidade: 'diario', entidade_id: v.id })
      nav(`/documentos/${doc.id}`)
    } catch (e) { toast(errMsg(e), 'error') }
  }

  return (
    <div className="space-y-4 pb-20">
      <PageHeader back={() => nav(-1)} title={isNew ? 'Novo diário de obra' : `Diário nº ${v.numero}`}
        subtitle={!isNew && <span className="flex items-center gap-2">{v.obra_nome} <Badge tone={fechado ? 'green' : 'yellow'}>{fechado ? 'Fechado' : 'Aberto'}</Badge></span>}
        actions={<>
          {isNew && <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={copiarAnterior}>Copiar do anterior</Button>}
          {!isNew && can('documentos.criar') && <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={gerarRDO}>Gerar RDO (PDF)</Button>}
          {!isNew && !fechado && can('diario.fechar') && <Button variant="secondary" icon={<Lock className="h-4 w-4" />} onClick={() => acao('fechar')}>Fechar</Button>}
          {!isNew && fechado && can('diario.reabrir') && <Button variant="secondary" icon={<Unlock className="h-4 w-4" />} onClick={() => acao('reabrir')}>Reabrir</Button>}
        </>} />

      <Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Field label="Obra" className="col-span-2" required>
            <RelationSelect endpoint="/obras" value={v.obra_id} onChange={(x) => set('obra_id', x)} disabled={!isNew} params={{ status: 'em_andamento' }} />
          </Field>
          <Field label="Data" required><Input type="date" max={hoje()} disabled={readOnly} value={v.data} onChange={(e) => set('data', e.target.value)} /></Field>
          {(['clima_manha', 'clima_tarde', 'clima_noite'] as const).map((k, i) => (
            <Field key={k} label={['Clima manhã', 'Clima tarde', 'Clima noite'][i]}>
              <Select disabled={readOnly} value={v[k] ?? ''} onChange={(e) => set(k, e.target.value || null)}>
                <option value="">—</option>{CLIMA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
          ))}
          <Field label="Condição de trabalho" className="col-span-2">
            <Select disabled={readOnly} value={v.condicao} onChange={(e) => set('condicao', e.target.value)}>
              <option value="praticavel">Praticável</option><option value="parcial">Parcialmente praticável</option><option value="impraticavel">Impraticável</option>
            </Select>
          </Field>
          <Field label="Temperatura"><Input disabled={readOnly} value={v.temperatura || ''} onChange={(e) => set('temperatura', e.target.value)} placeholder="ex.: 28 °C" /></Field>
          <Field label="Responsável" className="col-span-2 md:col-span-3"><Input disabled={readOnly} value={v.responsavel || ''} onChange={(e) => set('responsavel', e.target.value)} /></Field>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListEditor title={`Efetivo (${(v.efetivo || []).reduce((a: number, e: any) => a + Number(e.quantidade || 0), 0)} pessoas)`} disabled={readOnly}
          rows={v.efetivo || []} onChange={(r) => set('efetivo', r)} newRow={() => ({ funcao: '', quantidade: 1, empresa: 'propria' })}
          cols={[{ key: 'funcao', label: 'Função', grow: true }, { key: 'empresa', label: 'Empresa' }, { key: 'quantidade', label: 'Qtd.', type: 'number' }]} />
        <ListEditor title="Equipamentos" disabled={readOnly} rows={v.equipamentos || []} onChange={(r) => set('equipamentos', r)}
          newRow={() => ({ descricao: '', quantidade: 1, horas: null })}
          cols={[{ key: 'descricao', label: 'Descrição', grow: true }, { key: 'quantidade', label: 'Qtd.', type: 'number' }, { key: 'horas', label: 'Horas', type: 'number' }]} />
      </div>
      <ListEditor title="Atividades executadas" disabled={readOnly} rows={v.atividades || []} onChange={(r) => set('atividades', r)}
        newRow={() => ({ descricao: '', local: '', situacao: 'em_andamento', percentual: null })}
        cols={[{ key: 'descricao', label: 'Atividade', grow: true }, { key: 'local', label: 'Local' }, { key: 'situacao', label: 'Situação', type: 'select', options: SITUACAO },
          { key: 'percentual', label: '%', type: 'number' }]} />

      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          {[['materiais_recebidos', 'Materiais recebidos'], ['ocorrencias', 'Ocorrências / acidentes / paralisações'], ['visitas', 'Visitas e fiscalização'], ['observacoes', 'Observações gerais']].map(([k, l]) => (
            <Field key={k} label={l}><Textarea disabled={readOnly} value={v[k] || ''} onChange={(e) => set(k, e.target.value)} /></Field>
          ))}
        </div>
      </Card>

      {!isNew && <Card title="Fotos e anexos"><Attachments entidade="diario" entidadeId={v.id} canEdit={!fechado && can('diario.editar')} /></Card>}

      {!readOnly && (
        <div className="safe-bottom fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:bottom-0 md:left-64">
          <div className="mx-auto flex max-w-6xl justify-end gap-2">
            <Button variant="secondary" onClick={() => nav(-1)}>Cancelar</Button>
            <Button onClick={save} loading={saving}>Salvar diário</Button>
          </div>
        </div>
      )}
    </div>
  )
}
