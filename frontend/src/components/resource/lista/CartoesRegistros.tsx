import { renderCell } from '../cells'
import type { ColumnDef } from '../types'
import { type Acoes, AcoesLinha } from './AcoesLinha'

/** Listagem em cartões (celular): coluna principal em destaque e as demais em duas colunas. */
export function CartoesRegistros<T extends { id: number }>({ itens, colunas, principal, onLinha, acoes }: {
  itens: T[]; colunas: ColumnDef<T>[]; principal: ColumnDef<T>; onLinha: (r: T) => void; acoes: Acoes<T>
}) {
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
      {itens.map((row) => (
        <li key={row.id} className="p-3 active:bg-slate-50 dark:active:bg-slate-800" onClick={() => onLinha(row)}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{renderCell(principal, row)}</p>
            <AcoesLinha row={row} acoes={{ ...acoes, excluir: undefined }} compacto />
          </div>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {colunas.filter((c) => c !== principal && !c.hideMobile).map((c) => (
              <div key={c.key} className="min-w-0">
                <dt className="text-slate-400">{c.label}</dt>
                <dd className="truncate text-slate-700 dark:text-slate-300">{renderCell(c, row)}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  )
}
