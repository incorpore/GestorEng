import { ChevronLeft, ChevronRight, Copy, Loader2 } from 'lucide-react'
import { Select } from '@/components/ui'
import type { CampoPos } from './posicoes/campos'
import { PaginaMarcacao } from './posicoes/PaginaMarcacao'
import { usePdfPaginas } from './posicoes/usePdfPaginas'

export { type CampoPos, corAssinante } from './posicoes/campos'

/** Marcação manual dos locais de assinatura: escolha a pessoa, vá até a página e clique onde ela assina.
 *  O retângulo pode ser arrastado para ajustar ou removido no "x". */
export function PosicoesAssinatura({ docId, campos, nomes, ativo, onChange }: {
  docId: number; campos: CampoPos[]; nomes: string[]; ativo: number | null; onChange: (c: CampoPos[]) => void
}) {
  const { total, pagina, setPagina, imagem, erro } = usePdfPaginas(docId)

  if (erro) return <p className="text-xs text-rose-600">{erro}</p>
  if (!total) return <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo o documento...</p>
  const doAtivoAqui = ativo === null ? undefined : [...campos].reverse().find((c) => c.indice === ativo && c.pagina === pagina)
  const paginasDoAtivo = ativo === null ? 0 : new Set(campos.filter((c) => c.indice === ativo).map((c) => c.pagina)).size
  const porPagina = (k: number) => campos.filter((c) => c.pagina === k).length

  /** Copia o campo desta página para todas as páginas, na mesma posição. */
  function repetirEmTodas() {
    if (!doAtivoAqui) return
    const outros = campos.filter((c) => c.indice !== ativo)
    const copias = Array.from({ length: total }, (_, i) => ({ ...doAtivoAqui, pagina: i + 1 }))
    onChange([...outros, ...copias])
  }
  /** Remove os campos desta pessoa nas outras páginas. */
  function soNestaPagina() {
    onChange(campos.filter((c) => c.indice !== ativo || c.pagina === pagina))
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <button type="button" className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900"
          disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}><ChevronLeft className="h-4 w-4" />Anterior</button>
        <Select compacto aria-label="Ir para a página" value={pagina} onChange={(e) => setPagina(Number(e.target.value))}>
          {Array.from({ length: total }, (_, i) => i + 1).map((k) => <option key={k} value={k}>Página {k} de {total}{porPagina(k) ? ` · ${porPagina(k)} assinatura(s)` : ''}</option>)}
        </Select>
        <button type="button" className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900"
          disabled={pagina >= total} onClick={() => setPagina(pagina + 1)}>Próxima<ChevronRight className="h-4 w-4" /></button>
      </div>
      {ativo !== null && total > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">{nomes[ativo] || 'Assinante'}: {paginasDoAtivo ? `${paginasDoAtivo} página(s)` : 'nenhuma página'}</span>
          <button type="button" disabled={!doAtivoAqui} onClick={repetirEmTodas} title={doAtivoAqui ? '' : 'Marque primeiro nesta página'}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900">
            <Copy className="h-3.5 w-3.5" />Repetir em todas as páginas</button>
          <button type="button" disabled={!doAtivoAqui || paginasDoAtivo < 2} onClick={soNestaPagina}
            className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900">Só nesta página</button>
        </div>
      )}
      <div className="max-h-[60vh] overflow-y-auto">
        {!imagem ? <p className="flex items-center gap-2 p-6 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando a página...</p>
          : <PaginaMarcacao n={pagina} url={imagem} campos={campos} nomes={nomes} ativo={ativo} onChange={onChange} />}
      </div>
    </div>
  )
}
