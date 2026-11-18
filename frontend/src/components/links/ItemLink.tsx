import { useState, type ReactNode } from 'react'
import { Ban, Trash2 } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { dataHora } from '@/core/format'
import { AcessosLink } from './AcessosLink'
import type { LinkPublico } from './tipos'

/** Situação do link: ativo, finalizado por quem fotografou, encerrado ou expirado. */
export function SituacaoLink({ l }: { l: LinkPublico }) {
  return l.ativo ? <Badge tone="green">ativo</Badge>
    : l.encerramento === 'finalizado' ? <Badge tone="blue">finalizado por quem fotografou</Badge>
    : <Badge tone="gray">{l.encerramento === 'desativado' ? 'encerrado' : 'expirado'}</Badge>
}

/** Um link da lista "Links e acessos", com ações e o registro de acessos. */
export function ItemLink({ l, acoes, onEncerrar, onExcluir }: { l: LinkPublico; acoes: ReactNode; onEncerrar: () => void; onExcluir: () => void }) {
  const [verAcessos, setVerAcessos] = useState(false)
  return (
    <li className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{l.tipo === 'fotos' ? 'Pedido de fotos' : 'Visualização'}{l.destinatario && ` — ${l.destinatario}`} <SituacaoLink l={l} /></p>
          <p className="text-xs text-slate-500">{l.acessos} acesso(s){l.tipo === 'fotos' && ` · ${l.fotos_recebidas} foto(s)`} · expira {dataHora(l.expira_em)}</p>
        </div>
        <div className="flex gap-2">
          {l.ativo && acoes}
          {l.ativo && <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={onEncerrar}>Encerrar</Button>}
          <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={onExcluir}>Excluir</Button>
          <Button size="sm" variant="ghost" onClick={() => setVerAcessos(!verAcessos)}>{verAcessos ? 'Ocultar' : 'Acessos'}</Button>
        </div>
      </div>
      {verAcessos && <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800"><AcessosLink linkId={l.id} /></div>}
    </li>
  )
}
