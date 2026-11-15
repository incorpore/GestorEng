import { useState } from 'react'
import { Play } from 'lucide-react'
import { IconButton } from '@/components/ui'
import { ResourceList } from '@/components/resource/ResourcePage'
import type { ResourceConfig } from '@/components/resource/types'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'

/** Buscas salvas no PNCP (palavras-chave, UF, modalidades) executáveis com um clique. */
export function Monitores({ onResult }: { onResult: (r: { itens: any[]; erros: string[] }) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<number | null>(null)
  const cfg: ResourceConfig = {
    endpoint: '/pncp-monitores', title: 'Buscas salvas', singular: 'Busca salva', perm: 'licitacoes', formSize: 'md', defaultOrder: 'nome',
    fields: [
      { name: 'nome', label: 'Nome', required: true, span: 4 },
      { name: 'palavras_chave', label: 'Palavras-chave (vírgula)', span: 4 },
      { name: 'uf', label: 'UF', type: 'uf', span: 2 },
      { name: 'codigo_municipio_ibge', label: 'Município (cód. IBGE)', span: 2 },
      { name: 'modalidades', label: 'Modalidades (códigos)', default: '6,4,5,8', span: 4, hint: '6 Pregão eletr., 4 Concorrência eletr., 5 Concorrência pres., 8 Dispensa' },
      { name: 'ativo', label: 'Ativa', type: 'boolean', default: true },
    ],
    columns: [{ key: 'nome', label: 'Busca', primary: true }, { key: 'palavras_chave', label: 'Palavras' }, { key: 'uf', label: 'UF' }],
    rowActions: (r) => <IconButton label="Executar" disabled={busy === r.id} onClick={async () => {
      setBusy(r.id)
      try { onResult(await api.get(`/pncp/monitores/${r.id}/executar`)) } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(null) }
    }}><Play className="h-4 w-4 text-primary" /></IconButton>,
  }
  return <ResourceList hideHeader cfg={cfg} />
}
