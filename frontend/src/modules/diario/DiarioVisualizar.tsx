import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Card, Empty, IconButton, Loading } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { ClimaVisual } from './components/ClimaVisual'
import { DiarioCabecalho } from './components/DiarioCabecalho'
import { FotosDiario } from './components/FotosDiario'
import { Indicadores } from './components/Indicadores'
import { SecaoVisual } from './components/SecaoVisual'
import { SECOES } from './secoes'

export default function DiarioVisualizar() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const { can } = useAuth()
  const q = useQuery({ queryKey: ['/diarios', Number(id)], queryFn: () => api.get(`/diarios/${id}`) })
  const obra = useQuery({ queryKey: ['/obras', q.data?.obra_id], queryFn: () => api.get(`/obras/${q.data.obra_id}`), enabled: !!q.data })
  const fotos = useQuery({ queryKey: ['arquivos', 'diario', Number(id)], queryFn: () => api.get<any[]>('/arquivos', { entidade: 'diario', entidade_id: id }) })
  if (q.isLoading) return <Loading />
  if (!q.data) return <Empty title="Diário não encontrado" />
  const d = q.data
  const textos = [['Observações', d.observacoes], ['Materiais recebidos', d.materiais_recebidos], ['Ocorrências (texto)', d.ocorrencias], ['Visitas (texto)', d.visitas]]
    .filter(([, v]) => v)
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <IconButton label="Voltar" onClick={() => nav(-1)}><ChevronLeft className="h-5 w-5" /></IconButton>
      <DiarioCabecalho d={d} obra={obra.data} onAtualizar={(n) => { qc.setQueryData(['/diarios', Number(id)], n); qc.invalidateQueries({ queryKey: ['/diarios'] }) }} />
      <Indicadores equipe={d.total_efetivo} servicos={d.media_servicos} pendencias={d.pendencias_abertas}
        fotos={(fotos.data || []).filter((a) => a.mime.startsWith('image/')).length} />
      <FotosDiario diarioId={d.id} podeEditar={can('diario.editar') && d.status !== 'fechado'} />
      <ClimaVisual detalhe={d.clima_detalhe} manha={d.clima_manha} tarde={d.clima_tarde} condicao={d.condicao} />
      {SECOES.map((s) => <SecaoVisual key={s.chave} def={s} itens={d[s.chave]} />)}
      {textos.map(([t, v]) => <Card key={t} title={t}><p className="whitespace-pre-line text-sm">{v}</p></Card>)}
      <p className="pb-4 text-center text-xs text-slate-400">Responsável: {d.responsavel || '—'}</p>
    </div>
  )
}
