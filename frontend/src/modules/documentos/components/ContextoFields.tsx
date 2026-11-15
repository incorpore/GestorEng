import { useQuery } from '@tanstack/react-query'
import { Field, Select } from '@/components/ui'
import { RelationSelect } from '@/components/resource/RelationSelect'
import { api } from '@/core/api'

/** Endpoint de listagem e campo de rótulo de cada entidade usada como contexto de documentos. */
export const ENTIDADES: Record<string, { endpoint: string; labelKey?: string }> = {
  obra: { endpoint: '/obras' }, medicao: { endpoint: '/medicoes', labelKey: 'numero' }, diario: { endpoint: '/diarios', labelKey: 'data' },
  funcionario: { endpoint: '/funcionarios' }, parceiro: { endpoint: '/parceiros' }, licitacao: { endpoint: '/licitacoes', labelKey: 'objeto' },
  orcamento: { endpoint: '/orcamentos', labelKey: 'titulo' }, veiculo: { endpoint: '/veiculos', labelKey: 'descricao' },
  lancamento: { endpoint: '/lancamentos', labelKey: 'descricao' },
}

export function ContextoFields({ entidade, entidadeId, onChange, disabled }: {
  entidade: string | null; entidadeId: number | null; onChange: (e: string | null, id: number | null) => void; disabled?: boolean
}) {
  const vars = useQuery({ queryKey: ['doc-vars'], queryFn: () => api.get('/documentos-acoes/variaveis'), staleTime: 600_000 })
  const rotulos: Record<string, string> = vars.data?._rotulos || {}
  const cfg = entidade ? ENTIDADES[entidade] : null
  return (
    <>
      <Field label="Dados vinculados (contexto)">
        <Select disabled={disabled} value={entidade || ''} onChange={(e) => onChange(e.target.value || null, null)}>
          <option value="">Nenhum</option>
          {Object.entries(rotulos).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </Field>
      {cfg && (
        <Field label="Registro">
          <RelationSelect disabled={disabled} endpoint={cfg.endpoint} labelKey={cfg.labelKey} value={entidadeId} onChange={(id) => onChange(entidade, id)} />
        </Field>
      )}
    </>
  )
}
