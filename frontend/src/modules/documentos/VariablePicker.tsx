import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Input, Loading, Modal } from '@/components/ui'
import { api } from '@/core/api'

const GRUPOS: Record<string, string> = { geral: 'Geral', empresa: 'Empresa', _funcoes: 'Funções (tabelas e blocos)', _filtros: 'Filtros de formatação' }

export function VariablePicker({ open, onClose, onPick, entidade }: { open: boolean; onClose: () => void; onPick: (t: string) => void; entidade?: string | null }) {
  const { data, isLoading } = useQuery({ queryKey: ['doc-vars'], queryFn: () => api.get('/documentos-acoes/variaveis'), enabled: open, staleTime: 600_000 })
  const [q, setQ] = useState('')
  const [grupo, setGrupo] = useState<string>('geral')
  const grupos = useMemo(() => {
    if (!data) return []
    const keys = Object.keys(data).filter((k) => k !== '_rotulos')
    const ordered = ['geral', 'empresa', ...(entidade ? [entidade] : []), ...keys.filter((k) => !['geral', 'empresa', entidade].includes(k) && !k.startsWith('_')), '_funcoes', '_filtros']
    return ordered.filter((k) => data[k])
  }, [data, entidade])
  const items: { chave: string; descricao: string }[] = q
    ? grupos.flatMap((g) => data[g].map((x: any) => ({ ...x, g }))).filter((x: any) => (x.chave + x.descricao).toLowerCase().includes(q.toLowerCase()))
    : data?.[grupo] || []

  const toText = (g: string, chave: string) => {
    if (g === '_filtros') return `|${chave}`
    if (g === '_funcoes') {
      const ex: Record<string, string> = { tabela_medicao: 'tabela_medicao(medicao)', tabela_orcamento: 'tabela_orcamento(orcamento)', tabela_diario: 'tabela_diario(diario)',
        assinatura: 'assinatura(empresa.responsavel, empresa.cargo_responsavel, empresa.razao_social)', quebra_pagina: 'quebra_pagina()' }
      return `{{ ${ex[chave] || chave + '()'} }}`
    }
    if (chave.endsWith('.itens')) return `{% for i in ${chave} %}{{ i.descricao }}{% endfor %}`
    const money = /valor|preco|custo|total|salario/.test(chave) ? '|moeda' : /data|vencimento|inicio|fim|emissao/.test(chave) ? '|data' : ''
    return `{{ ${chave}${money} }}`
  }

  return (
    <Modal open={open} onClose={onClose} title="Inserir variável" size="lg">
      {isLoading || !data ? <Loading /> : (
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex gap-1 overflow-x-auto md:w-48 md:flex-col">
            {grupos.map((g) => (
              <button key={g} type="button" onClick={() => { setGrupo(g); setQ('') }}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-left text-sm ${grupo === g && !q ? 'bg-primary-100 font-medium text-primary' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                {GRUPOS[g] || data._rotulos?.[g] || g}
              </button>
            ))}
          </div>
          <div className="flex-1">
            <Input placeholder="Buscar variável..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
            <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {items.map((x: any) => (
                <li key={(x.g || grupo) + x.chave}>
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => onPick(toText(x.g || grupo, x.chave))}>
                    <code className="text-xs text-primary">{toText(x.g || grupo, x.chave)}</code>
                    <span className="text-right text-xs text-slate-500">{x.descricao}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">Filtros: <code>moeda</code>, <code>data</code>, <code>data_extenso</code>, <code>extenso</code> (valor por extenso), <code>cpf_cnpj</code>, <code>numero</code>, <code>percentual</code>. Ex.: <code>{'{{ obra.valor_contrato|extenso }}'}</code></p>
          </div>
        </div>
      )}
    </Modal>
  )
}
