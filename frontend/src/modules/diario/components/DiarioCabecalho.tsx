import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileDown, Link2, Lock, MapPin, Pencil, PenLine, Unlock } from 'lucide-react'
import { LinkPublicoModal } from '@/components/links/LinkPublicoModal'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { openApiFile } from '@/core/files'
import { errMsg, useToast } from '@/core/toast'

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

/** Cabeçalho escuro do diário com obra, data e ações (PDF, assinatura, link público, editar, fechar). */
export function DiarioCabecalho({ d, obra, onAtualizar }: { d: any; obra: any; onAtualizar: (d: any) => void }) {
  const nav = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const [link, setLink] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const dt = new Date(d.data + 'T12:00')
  const local = [obra?.endereco, obra?.cidade && `${obra.cidade}/${obra.uf || ''}`].filter(Boolean).join(', ')
  const fechado = d.status === 'fechado'

  async function run(k: string, fn: () => Promise<void>) {
    setBusy(k)
    try { await fn() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(null) }
  }
  const btn = 'inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50'
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 p-5 text-white shadow-lg">
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <span className="rounded-full bg-white/15 px-2.5 py-1">{d.obra_nome}</span>
        {obra?.numero_contrato && <span className="rounded-full bg-white/15 px-2.5 py-1">{obra.numero_contrato}</span>}
        <span className="rounded-full bg-white/15 px-2.5 py-1">RDO nº {String(d.numero).padStart(4, '0')}</span>
        {fechado && <span className="rounded-full bg-emerald-500/80 px-2.5 py-1">Fechado</span>}
      </div>
      <p className="mt-3 text-xs uppercase tracking-widest text-white/60">{DIAS[dt.getDay()]}</p>
      <h1 className="text-3xl font-bold">{dt.toLocaleDateString('pt-BR')}</h1>
      {local && <p className="mt-1 flex items-center gap-1 text-sm text-white/70"><MapPin className="h-4 w-4" />{local}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={btn} disabled={busy === 'pdf'} onClick={() => run('pdf', () => openApiFile(`/diarios-acoes/${d.id}/pdf`, `RDO-${d.numero}-${d.data}.pdf`))}>
          <FileDown className="h-4 w-4 text-rose-300" />{busy === 'pdf' ? 'Gerando...' : 'PDF'}</button>
        {can('documentos.criar') && <button className={btn} disabled={busy === 'doc'} onClick={() => run('doc', async () => {
          const r = await api.post(`/diarios-acoes/${d.id}/documento`, {}); toast(`Documento ${r.numero} gerado`); nav(`/documentos/${r.documento_id}`) })}>
          <PenLine className="h-4 w-4 text-amber-300" />Assinar (Documenso)</button>}
        {can('diario.editar') && <button className={btn} onClick={() => setLink(true)}><Link2 className="h-4 w-4 text-sky-300" />Link público</button>}
        {!fechado && can('diario.editar') && <button className={btn} onClick={() => nav(`/diario/${d.id}/editar`)}><Pencil className="h-4 w-4 text-yellow-300" />Editar</button>}
        {!fechado && can('diario.fechar') && <button className={btn} onClick={() => run('f', async () => { onAtualizar(await api.post(`/diarios-acoes/${d.id}/fechar`)); toast('Diário fechado') })}><Lock className="h-4 w-4" />Fechar</button>}
        {fechado && can('diario.reabrir') && <button className={btn} onClick={() => run('r', async () => { onAtualizar(await api.post(`/diarios-acoes/${d.id}/reabrir`)); toast('Diário reaberto') })}><Unlock className="h-4 w-4" />Reabrir</button>}
      </div>
      <LinkPublicoModal entidade="diario" entidadeId={d.id} tipoInicial="visualizar" open={link} onClose={() => setLink(false)} />
    </div>
  )
}
