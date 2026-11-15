import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Import } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { dataHora, moeda } from '@/core/format'
import { errMsg, useToast } from '@/core/toast'

export function PncpItem({ item }: { item: any }) {
  const { can } = useAuth()
  const toast = useToast()
  const [id, setId] = useState<number | null>(item.licitacao_id)
  const [loading, setLoading] = useState(false)
  async function importar() {
    setLoading(true)
    try { const r = await api.post('/pncp/importar', { item }); setId(r.id); toast('Licitação importada') } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone="purple">{item.modalidade}</Badge>
        {item.situacao && <Badge>{item.situacao}</Badge>}
        <span className="text-slate-500">{item.orgao_nome} · {item.municipio}/{item.uf}</span>
      </div>
      <p className="text-sm">{item.objeto}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Abertura {dataHora(item.data_abertura)} · Encerra {dataHora(item.data_encerramento_proposta)} · <strong className="text-slate-700 dark:text-slate-200">{moeda(item.valor_estimado)}</strong></p>
        <div className="flex gap-2">
          {item.link_edital && <a href={item.link_edital} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" icon={<ExternalLink className="h-3.5 w-3.5" />}>PNCP</Button></a>}
          {id ? <Link to="/licitacoes"><Button size="sm" variant="secondary" icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}>Importada</Button></Link>
            : can('licitacoes.criar') && <Button size="sm" onClick={importar} loading={loading} icon={<Import className="h-3.5 w-3.5" />}>Importar</Button>}
        </div>
      </div>
    </li>
  )
}
