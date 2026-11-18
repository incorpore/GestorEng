import { ArrowDown, ArrowUp } from 'lucide-react'
import clsx from 'clsx'
import { renderCell } from '../cells'
import type { ColumnDef } from '../types'
import { type Acoes, AcoesLinha } from './AcoesLinha'

/** Tabela da listagem (telas maiores), com ordenação pelo cabeçalho. */
export function TabelaRegistros<T extends { id: number }>({ itens, colunas, ordem, onOrdenar, onLinha, acoes, carregando }: {
  itens: T[]; colunas: ColumnDef<T>[]; ordem?: string; onOrdenar: (k: string) => void; onLinha: (r: T) => void; acoes: Acoes<T>; carregando?: boolean
}) {
  return (
    <div className={clsx('hidden overflow-x-auto md:block', carregando && 'opacity-70')}>
      <table className="tbl">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.key} className={clsx(c.align === 'right' && 'text-right', c.sortable !== false && 'cursor-pointer select-none')}
                onClick={() => c.sortable !== false && !c.key.includes('.') && !c.render && onOrdenar(c.key)}>
                <span className="inline-flex items-center gap-1">{c.label}
                  {ordem === c.key && <ArrowUp className="h-3 w-3" />}{ordem === `-${c.key}` && <ArrowDown className="h-3 w-3" />}
                </span>
              </th>
            ))}
            <th className="w-px" />
          </tr>
        </thead>
        <tbody>
          {itens.map((row) => (
            <tr key={row.id} className="cursor-pointer" onClick={() => onLinha(row)}>
              {colunas.map((c) => (
                <td key={c.key} className={clsx(c.align === 'right' && 'text-right tabular-nums', c.className)}>{renderCell(c, row)}</td>
              ))}
              <td><AcoesLinha row={row} acoes={acoes} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
