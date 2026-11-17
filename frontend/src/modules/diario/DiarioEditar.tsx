import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Copy, HardHat, ListChecks, Truck } from 'lucide-react'
import { Badge, Button, Card, Field, Input, Loading, PageHeader, Textarea } from '@/components/ui'
import { RelationSelect } from '@/components/resource/RelationSelect'
import { api } from '@/core/api'
import { hoje } from '@/core/format'
import { errMsg, useToast } from '@/core/toast'
import { ClimaHoje } from '../obras/components/ClimaHoje'
import { ClimaEditor } from './components/ClimaEditor'
import { SecaoEditor } from './components/SecaoEditor'
import { SeletorModal } from './components/SeletorModal'
import { secao, SECOES } from './secoes'

const CAMPOS = ['obra_id', 'data', 'condicao', 'clima_detalhe', 'clima_atual', 'efetivo', 'equipamentos', 'materiais', 'atividades',
  'visitas_lista', 'ocorrencias_lista', 'pendencias', 'providencias', 'observacoes', 'responsavel']
const PRINCIPAL: Record<string, string> = { efetivo: 'nome', equipamentos: 'descricao', materiais: 'descricao', atividades: 'descricao',
  visitas_lista: 'visitante', ocorrencias_lista: 'descricao', pendencias: 'descricao', providencias: 'descricao' }
const VAZIO = { condicao: 'praticavel', clima_detalhe: {}, efetivo: [], equipamentos: [], materiais: [], atividades: [], visitas_lista: [],
  ocorrencias_lista: [], pendencias: [], providencias: [] }

export default function DiarioEditar() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const novo = !id || id === 'novo'
  const q = useQuery({ queryKey: ['/diarios', Number(id)], queryFn: () => api.get(`/diarios/${id}`), enabled: !novo })
  const [v, setV] = useState<any>(null)
  const [origem, setOrigem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [seletor, setSeletor] = useState<null | 'equipe' | 'maquinas' | 'servicos'>(null)
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))

  useEffect(() => {
    if (novo && !v) setV({ ...VAZIO, obra_id: sp.get('obra') ? Number(sp.get('obra')) : null, data: hoje() })
    else if (!novo && q.data) setV({ ...VAZIO, ...q.data, clima_detalhe: q.data.clima_detalhe || {} })
  }, [novo, q.data, sp, v])

  // novo diário: traz equipe, máquinas, serviços em andamento e pendências não resolvidas do anterior
  useEffect(() => {
    if (!novo || !v?.obra_id || !v?.data) return
    api.get('/diarios-acoes/modelo', { obra_id: v.obra_id, data: v.data }).then((m) => {
      setOrigem(m.origem)
      setV((s: any) => ({ ...s, efetivo: m.efetivo, equipamentos: m.equipamentos, atividades: m.atividades, pendencias: m.pendencias }))
    }).catch(() => null)
  }, [novo, v?.obra_id, v?.data]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!v) return <Loading />
  const ids = (lista: any[], k: string) => new Set<number>(lista.map((x) => x[k]).filter(Boolean))

  async function salvar() {
    setSaving(true)
    try {
      const body: any = {}
      CAMPOS.forEach((k) => (body[k] = v[k] === '' ? null : v[k]))
      for (const [k, campo] of Object.entries(PRINCIPAL)) {
        body[k] = (v[k] || []).filter((x: any) => x[campo] || (k === 'efetivo' && x.funcao))
      }
      const r = novo ? await api.post('/diarios', body) : await api.patch(`/diarios/${id}`, body)
      qc.invalidateQueries({ queryKey: ['/diarios'] })
      toast('Diário salvo')
      nav(`/diario/${r.id}`, { replace: true })
    } catch (e) { toast(errMsg(e), 'error') } finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      <PageHeader back={() => nav(-1)} title={novo ? 'Novo diário' : `Editar diário nº ${v.numero}`} subtitle={v.obra_nome} />
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Obra" required className="sm:col-span-2"><RelationSelect endpoint="/obras" value={v.obra_id} disabled={!novo} params={{ status: 'em_andamento' }} onChange={(x) => set('obra_id', x)} /></Field>
          <Field label="Data" required><Input type="date" max={hoje()} value={v.data} onChange={(e) => set('data', e.target.value)} /></Field>
          <Field label="Responsável" className="sm:col-span-3"><Input value={v.responsavel || ''} onChange={(e) => set('responsavel', e.target.value)} placeholder="Seu nome (padrão)" /></Field>
        </div>
        {origem && <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Copy className="h-3.5 w-3.5" />Equipe, máquinas, serviços em andamento e pendências em aberto copiados do diário nº {origem.numero} ({new Date(origem.data + 'T12:00').toLocaleDateString('pt-BR')}).</p>}
      </Card>
      {v.obra_id && <ClimaHoje obraId={v.obra_id} />}
      <ClimaEditor obraId={v.obra_id} data={v.data} valor={v.clima_detalhe || {}} condicao={v.condicao} onChange={(x) => set('clima_detalhe', x)}
        onCondicao={(x) => set('condicao', x)} onAtual={(x) => set('clima_atual', x)} />

      <SecaoEditor def={secao('efetivo')} itens={v.efetivo} onChange={(x) => set('efetivo', x)}
        acoes={v.obra_id && <Button size="sm" variant="ghost" icon={<HardHat className="h-4 w-4" />} onClick={() => setSeletor('equipe')}>Da equipe</Button>} />
      <SecaoEditor def={secao('equipamentos')} itens={v.equipamentos} onChange={(x) => set('equipamentos', x)}
        acoes={<Button size="sm" variant="ghost" icon={<Truck className="h-4 w-4" />} onClick={() => setSeletor('maquinas')}>Da frota</Button>} />
      <SecaoEditor def={secao('materiais')} itens={v.materiais} onChange={(x) => set('materiais', x)} />
      <SecaoEditor def={secao('atividades')} itens={v.atividades} onChange={(x) => set('atividades', x)}
        acoes={v.obra_id && <Button size="sm" variant="ghost" icon={<ListChecks className="h-4 w-4" />} onClick={() => setSeletor('servicos')}>Do cronograma</Button>}
        topoItem={(it) => it.servico_id ? <Badge tone="blue">Serviço do cronograma</Badge> : null} />
      {SECOES.filter((s) => ['visitas_lista', 'ocorrencias_lista', 'pendencias', 'providencias'].includes(s.chave)).map((s) => (
        <SecaoEditor key={s.chave} def={s} itens={v[s.chave]} onChange={(x) => set(s.chave, x)} />
      ))}
      <Card title="Observações"><Textarea rows={3} value={v.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)} /></Card>
      {!novo && <p className="text-center text-xs text-slate-400">As fotos são adicionadas na tela do diário.</p>}

      <SeletorModal titulo="Adicionar da equipe" open={seletor === 'equipe'} onClose={() => setSeletor(null)} chave={['equipe', v.obra_id]}
        carregar={() => api.get('/equipe', { obra_id: v.obra_id })} rotulo={(f: any) => f.nome} detalhe={(f: any) => f.funcao}
        jaIncluidos={ids(v.efetivo, 'funcionario_id')}
        onAdicionar={(fs: any[]) => set('efetivo', [...v.efetivo, ...fs.map((f) => ({ funcionario_id: f.id, nome: f.nome, funcao: f.funcao, horas: 8, quantidade: 1, empresa: 'propria' }))])} />
      <SeletorModal titulo="Adicionar da frota" open={seletor === 'maquinas'} onClose={() => setSeletor(null)} chave={['frota-sel', v.obra_id]}
        carregar={async () => (await api.get('/veiculos', { page_size: 300, status__ne: 'inativo' })).items}
        rotulo={(x: any) => `${x.identificacao} — ${x.descricao}`} detalhe={(x: any) => x.obra_nome} jaIncluidos={ids(v.equipamentos, 'veiculo_id')}
        onAdicionar={(xs: any[]) => set('equipamentos', [...v.equipamentos, ...xs.map((x) => ({ veiculo_id: x.id, descricao: `${x.identificacao} — ${x.descricao}`, quantidade: 1, horas: null }))])} />
      <SeletorModal titulo="Serviços do cronograma" open={seletor === 'servicos'} onClose={() => setSeletor(null)} chave={['cronograma', v.obra_id]}
        carregar={async () => (await api.get('/servicos-obra', { obra_id: v.obra_id, page_size: 500 })).items}
        rotulo={(s: any) => s.descricao} detalhe={(s: any) => `${s.local || ''} · ${Number(s.percentual).toFixed(0)}% · ${new Date(s.inicio + 'T12:00').toLocaleDateString('pt-BR')} a ${new Date(s.fim + 'T12:00').toLocaleDateString('pt-BR')}`}
        jaIncluidos={ids(v.atividades, 'servico_id')}
        onAdicionar={(ss: any[]) => set('atividades', [...v.atividades, ...ss.map((s) => ({ servico_id: s.id, descricao: s.descricao, local: s.local, percentual: Number(s.percentual) }))])} />

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:bottom-0 md:left-64">
        <div className="mx-auto flex max-w-4xl gap-2">
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => nav(-1)}>Cancelar</Button>
          <Button className="flex-1" onClick={salvar} loading={saving}>{novo ? 'Criar diário' : 'Salvar diário'}</Button>
        </div>
      </div>
    </div>
  )
}
