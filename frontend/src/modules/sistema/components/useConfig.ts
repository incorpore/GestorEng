import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'

/** Carrega/salva uma chave de /configuracoes/{chave} com estado local editável. */
export function useConfig(chave: string) {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery({ queryKey: ['config', chave], queryFn: () => api.get(`/configuracoes/${chave}`) })
  const [v, setV] = useState<Record<string, any> | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (q.data) setV(q.data) }, [q.data])
  const set = (k: string, x: any) => setV((s) => ({ ...(s || {}), [k]: x }))
  async function save(extra?: Record<string, any>) {
    setSaving(true)
    try { const r = await api.put(`/configuracoes/${chave}`, { ...v, ...extra }); setV(r); qc.setQueryData(['config', chave], r); toast('Configurações salvas'); return r }
    catch (e) { toast(errMsg(e), 'error') } finally { setSaving(false) }
  }
  return { v, set, setV, save, saving, loading: q.isLoading, reload: () => qc.invalidateQueries({ queryKey: ['config', chave] }) }
}
