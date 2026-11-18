import { useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { Button } from '@/components/ui'
import { type CampoPos, corAssinante, PosicoesAssinatura } from '../PosicoesAssinatura'
import { type Assinante, mesmoEmail } from './tipos'

export type PosicaoEmail = CampoPos & { email: string }

/** "Posição das assinaturas": escolher a pessoa e marcar no documento (uma ou várias páginas). */
export function SecaoPosicoes({ docId, rows, campos, onChange }: {
  docId: number; rows: Assinante[]; campos: PosicaoEmail[]; onChange: (c: PosicaoEmail[]) => void
}) {
  const [marcando, setMarcando] = useState(false)
  const [ativo, setAtivo] = useState<string | null>(null) // e-mail de quem está sendo marcado
  const idx = (email: string) => rows.findIndex((r) => mesmoEmail(r.email, email))
  const incompleto = rows.some((r) => !r.nome.trim() || !r.email.trim())

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Posição das assinaturas</p>
          <p className="text-xs text-slate-500">{campos.length ? `${campos.length} campo(s) marcado(s). Quem não for marcado assina no rodapé da última página.` : 'Sem marcação: as assinaturas ficam lado a lado no rodapé da última página.'}</p>
        </div>
        <Button size="sm" variant="secondary" icon={<MousePointerClick className="h-4 w-4" />} disabled={incompleto}
          onClick={() => { setMarcando(!marcando); if (!ativo) setAtivo(rows.find((r) => r.papel === 'SIGNER')?.email || null) }}>{marcando ? 'Ocultar documento' : 'Marcar no documento'}</Button>
      </div>
      {marcando && (
        <>
          <p className="mt-2 text-xs text-slate-500">Escolha a pessoa e clique no documento sobre a linha onde ela assina. Arraste o retângulo para ajustar.</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {rows.filter((r) => r.papel === 'SIGNER').map((r) => {
              const pags = [...new Set(campos.filter((x) => mesmoEmail(x.email, r.email)).map((x) => x.pagina))].sort((a, b) => a - b)
              const i = idx(r.email)
              const sel = !!ativo && mesmoEmail(ativo, r.email)
              return <li key={r.id}><button type="button" onClick={() => setAtivo(r.email)} aria-pressed={sel}
                className="flex items-center gap-1 rounded-full border-2 px-2.5 py-1"
                style={{ borderColor: corAssinante(i), background: sel ? `${corAssinante(i)}22` : undefined, fontWeight: sel ? 600 : 400 }}>
                <span className="h-2 w-2 rounded-full" style={{ background: corAssinante(i) }} />{r.nome || 'Assinante'}: {!pags.length ? 'não marcado' : pags.length > 4 ? `${pags.length} páginas` : `pág. ${pags.join(', ')}`}</button></li>
            })}
          </ul>
          <div className="mt-2"><PosicoesAssinatura docId={docId} campos={campos} nomes={rows.map((r) => r.nome)} ativo={ativo ? idx(ativo) : null}
            onChange={(cs) => onChange(cs.map((c) => ({ ...c, email: rows[c.indice].email })))} /></div>
        </>
      )}
    </div>
  )
}
