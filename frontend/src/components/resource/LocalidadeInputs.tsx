import { useMemo, useRef, useState, useEffect } from 'react'
import { Crosshair, Loader2 } from 'lucide-react'
import { Input, Select } from '@/components/ui'
import { obterLocalizacao, GEO_MSG } from '@/core/geo'
import { useEstados, useMunicipios } from '@/core/localidades'
import { useToast } from '@/core/toast'

export function UfSelect({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const { data } = useEstados()
  return (
    <Select disabled={disabled} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">—</option>
      {(data || []).map((e) => <option key={e.sigla} value={e.sigla}>{e.sigla} — {e.nome}</option>)}
    </Select>
  )
}

/** Município com busca, a partir da UF escolhida (IBGE). Opcionalmente informa o código IBGE. */
export function MunicipioSelect({ uf, value, onChange, disabled }: {
  uf?: string | null; value: string | null; onChange: (nome: string | null, ibge?: number | null) => void; disabled?: boolean
}) {
  const { data, isLoading } = useMunicipios(uf)
  const [q, setQ] = useState(value || '')
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => setQ(value || ''), [value])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const lista = useMemo(() => (data || []).filter((m) => norm(m.nome).includes(norm(q))).slice(0, 60), [data, q])
  if (!uf) return <Input disabled placeholder="Escolha a UF primeiro" />
  return (
    <div ref={ref} className="relative">
      <Input disabled={disabled} value={q} placeholder={isLoading ? 'Carregando municípios...' : 'Digite para buscar'}
        onFocus={() => setAberto(true)} onChange={(e) => { setQ(e.target.value); setAberto(true) }}
        onBlur={() => { if (!q) onChange(null, null) }} />
      {aberto && lista.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {lista.map((m) => (
            <li key={m.id}><button type="button" className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(m.nome, m.id); setQ(m.nome); setAberto(false) }}>{m.nome}</button></li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Latitude com botão "usar minha localização" que também preenche a longitude. */
export function GeoInput({ value, onChange, onCoords, disabled }: {
  value: string | null; onChange: (v: string | null) => void; onCoords: (lat: string, lon: string) => void; disabled?: boolean
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function capturar() {
    setBusy(true)
    const r = await obterLocalizacao()
    setBusy(false)
    if (r.ok) { onCoords(r.coords.latitude.toFixed(7), r.coords.longitude.toFixed(7)); toast('Localização capturada') }
    else toast(GEO_MSG[r.erro], 'error')
  }
  return (
    <div className="flex gap-1">
      <Input disabled={disabled} inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} placeholder="-27.4946870" />
      <button type="button" title="Usar minha localização atual" onClick={capturar} disabled={disabled || busy}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
      </button>
    </div>
  )
}
