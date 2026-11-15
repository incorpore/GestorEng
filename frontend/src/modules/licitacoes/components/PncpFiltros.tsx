import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Button, Field, Input, Select } from '@/components/ui'
import { UFS } from '@/components/resource/FieldInput'
import { api } from '@/core/api'

export interface PncpParams { modo: 'abertas' | 'publicadas'; modalidade: number; uf: string; palavras: string; data_inicial: string; data_final: string; pagina: number }

export function PncpFiltros({ v, set, onSearch, loading }: { v: PncpParams; set: (p: Partial<PncpParams>) => void; onSearch: () => void; loading: boolean }) {
  const mods = useQuery({ queryKey: ['pncp-mods'], queryFn: () => api.get('/pncp/modalidades'), staleTime: Infinity })
  return (
    <form className="grid grid-cols-2 gap-3 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); onSearch() }}>
      <Field label="Busca">
        <Select value={v.modo} onChange={(e) => set({ modo: e.target.value as PncpParams['modo'] })}>
          <option value="abertas">Propostas abertas</option><option value="publicadas">Publicadas no período</option>
        </Select>
      </Field>
      <Field label="Modalidade">
        <Select value={v.modalidade} onChange={(e) => set({ modalidade: Number(e.target.value) })}>
          {(mods.data || []).map((m: any) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
        </Select>
      </Field>
      <Field label="UF"><Select value={v.uf} onChange={(e) => set({ uf: e.target.value })}><option value="">Todas</option>{UFS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
      <Field label="Palavras-chave" className="col-span-2 md:col-span-3" hint="Separe por vírgula: pavimentação, drenagem, reforma">
        <Input value={v.palavras} onChange={(e) => set({ palavras: e.target.value })} />
      </Field>
      {v.modo === 'publicadas' && <>
        <Field label="De"><Input type="date" value={v.data_inicial} onChange={(e) => set({ data_inicial: e.target.value })} /></Field>
        <Field label="Até"><Input type="date" value={v.data_final} onChange={(e) => set({ data_final: e.target.value })} /></Field>
      </>}
      <div className="col-span-2 flex items-end md:col-span-1"><Button type="submit" className="w-full" loading={loading} icon={<Search className="h-4 w-4" />}>Buscar no PNCP</Button></div>
    </form>
  )
}
