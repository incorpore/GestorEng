import { useState } from 'react'
import { Card, Empty, Loading, Pagination } from '@/components/ui'
import { api } from '@/core/api'
import { hoje } from '@/core/format'
import { errMsg, useToast } from '@/core/toast'
import { PncpFiltros, type PncpParams } from './components/PncpFiltros'
import { PncpItem } from './components/PncpItem'
import { Monitores } from './components/Monitores'

export default function PncpBusca() {
  const toast = useToast()
  const [v, setV] = useState<PncpParams>({ modo: 'abertas', modalidade: 6, uf: '', palavras: '', data_inicial: hoje(), data_final: hoje(), pagina: 1 })
  const [res, setRes] = useState<{ itens: any[]; total_paginas?: number; total_registros?: number; erros?: string[] } | null>(null)
  const [loading, setLoading] = useState(false)

  async function buscar(pagina = 1) {
    setLoading(true)
    try {
      setRes(await api.get('/pncp/buscar', { ...v, pagina, data_inicial: v.modo === 'publicadas' ? v.data_inicial : undefined, data_final: v.modo === 'publicadas' ? v.data_final : undefined }))
      setV((s) => ({ ...s, pagina }))
    } catch (e) { toast(errMsg(e), 'error') } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <Card><PncpFiltros v={v} set={(p) => setV((s) => ({ ...s, ...p }))} onSearch={() => buscar(1)} loading={loading} /></Card>
      <Card title="Buscas salvas" padded={false}><div className="p-3"><Monitores onResult={(r) => setRes(r)} /></div></Card>
      {loading ? <Loading /> : res && (
        <Card padded={false} title={`${res.itens.length} resultado(s)${res.total_registros ? ` nesta página · ${res.total_registros} no total` : ''}`}>
          {res.erros?.map((e) => <p key={e} className="px-4 pt-3 text-xs text-rose-600">{e}</p>)}
          {!res.itens.length ? <Empty title="Nada encontrado" text="Ajuste palavras-chave, UF ou modalidade. A filtragem por palavras é feita sobre a página retornada." />
            : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{res.itens.map((i) => <PncpItem key={i.pncp_controle} item={i} />)}</ul>}
          {res.total_paginas ? <div className="px-4"><Pagination page={v.pagina} pageSize={50} total={(res.total_paginas || 1) * 50} onChange={buscar} /></div> : null}
        </Card>
      )}
    </div>
  )
}
