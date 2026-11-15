import { Card } from '@/components/ui'
import { ItemsGrid } from '@/components/resource/ItemsGrid'

const total = (r: any) => (r.agrupador ? 0 : Number(r.quantidade || 0) * Number(r.preco_unitario || 0))

/** Planilha orçamentária: etapas (agrupadores) e serviços. */
export function OrcamentoItens({ itens, onChange }: { itens: any[]; onChange: (r: any[]) => void }) {
  return (
    <Card title="Planilha orçamentária">
      <ItemsGrid rows={itens} onChange={onChange} rowClass={(r) => (r.agrupador ? 'bg-slate-50 font-semibold dark:bg-slate-800/40' : undefined)}
        newRow={() => ({ item: '', agrupador: false, fonte: 'SINAPI', codigo: '', descricao: '', unidade: 'un', quantidade: 0, preco_unitario: 0 })}
        cols={[
          { key: 'item', label: 'Item', width: '70px' },
          { key: 'agrupador', label: 'Etapa', type: 'bool', width: '56px' },
          { key: 'fonte', label: 'Fonte', width: '90px' },
          { key: 'codigo', label: 'Código', width: '90px' },
          { key: 'descricao', label: 'Descrição', type: 'textarea' },
          { key: 'unidade', label: 'Un.', width: '64px' },
          { key: 'quantidade', label: 'Qtd.', type: 'number', width: '100px' },
          { key: 'preco_unitario', label: 'Preço unit.', type: 'money', width: '120px' },
          { key: 'total', label: 'Total', compute: total, format: 'money' },
        ]} />
    </Card>
  )
}

export function totais(v: any) {
  const cd = (v.itens || []).reduce((a: number, r: any) => a + total(r), 0)
  const bdi = (cd * Number(v.bdi || 0)) / 100
  const desc = ((cd + bdi) * Number(v.desconto || 0)) / 100
  return { cd, bdi, desc, total: cd + bdi - desc }
}
