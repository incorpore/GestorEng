import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'

interface Pasta { id: string; nome: string; parent_id: string | null }
const CHAVE = 'struvia-pasta-documenso'

export const pastaLembrada = () => { try { return localStorage.getItem(CHAVE) || '' } catch { return '' } }
const lembrar = (id: string) => { try { localStorage.setItem(CHAVE, id) } catch { /* ignora */ } }

/** Ordena as pastas como árvore (pai seguido dos filhos) com o nível de cada uma. */
function arvore(pastas: Pasta[]) {
  const filhos = new Map<string | null, Pasta[]>()
  const ids = new Set(pastas.map((p) => p.id))
  for (const p of pastas) {
    const pai = p.parent_id && ids.has(p.parent_id) ? p.parent_id : null
    filhos.set(pai, [...(filhos.get(pai) || []), p])
  }
  const out: { p: Pasta; nivel: number }[] = []
  const visitar = (pai: string | null, nivel: number) => {
    for (const p of (filhos.get(pai) || []).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))) { out.push({ p, nivel }); if (nivel < 8) visitar(p.id, nivel + 1) }
  }
  visitar(null, 0)
  return out
}

/** Pasta do Documenso onde o documento ficará; "+" cria uma pasta (ou subpasta da selecionada) em pop-up. */
export function PastaDocumenso({ value, onChange, enabled }: { value: string; onChange: (id: string) => void; enabled: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery({ queryKey: ['documenso-pastas'], queryFn: () => api.get<Pasta[]>('/documentos-acoes/documenso/pastas'), enabled, retry: false, staleTime: 60_000 })
  const [nova, setNova] = useState<{ nome: string; pai: string } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const itens = arvore(q.data || [])
  const escolher = (id: string) => { lembrar(id); onChange(id) }

  async function criar() {
    if (!nova) return
    setSalvando(true)
    try {
      const p = await api.post<Pasta>('/documentos-acoes/documenso/pastas', { nome: nova.nome, parent_id: nova.pai || null })
      qc.setQueryData<Pasta[]>(['documenso-pastas'], (l) => [...(l || []), p])
      escolher(p.id); setNova(null); toast(`Pasta "${p.nome}" criada no Documenso`)
    } catch (e) { toast(errMsg(e), 'error') } finally { setSalvando(false) }
  }

  if (q.isError) return <Field label="Pasta no Documenso"><p className="text-xs text-amber-600">{errMsg(q.error)} O documento irá para a pasta principal.</p></Field>
  return (
    <Field label="Pasta no Documenso">
      <div className="flex gap-1">
        <Select className="min-w-0 flex-1" value={value} onChange={(e) => escolher(e.target.value)} disabled={q.isLoading}>
          <option value="">{q.isLoading ? 'Carregando pastas...' : 'Pasta principal (sem pasta)'}</option>
          {itens.map(({ p, nivel }) => <option key={p.id} value={p.id}>{`${'   '.repeat(nivel)}${nivel ? '└ ' : ''}${p.nome}`}</option>)}
        </Select>
        <button type="button" title="Nova pasta" aria-label="Nova pasta no Documenso" onClick={() => setNova({ nome: '', pai: value })}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-primary hover:bg-primary-50 dark:border-slate-700">
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>
      <Modal open={!!nova} onClose={() => setNova(null)} title="Nova pasta no Documenso" size="sm"
        footer={<><Button variant="secondary" onClick={() => setNova(null)}>Cancelar</Button><Button onClick={criar} loading={salvando} disabled={!nova?.nome.trim()}>Criar pasta</Button></>}>
        {nova && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); if (nova.nome.trim()) criar() }}>
            <Field label="Nome"><Input autoFocus maxLength={120} value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} placeholder="Ex.: Obra Escola Municipal" /></Field>
            <Field label="Dentro de">
              <Select value={nova.pai} onChange={(e) => setNova({ ...nova, pai: e.target.value })}>
                <option value="">Pasta principal</option>
                {itens.map(({ p, nivel }) => <option key={p.id} value={p.id}>{`${'   '.repeat(nivel)}${nivel ? '└ ' : ''}${p.nome}`}</option>)}
              </Select>
            </Field>
          </form>
        )}
      </Modal>
    </Field>
  )
}
