import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react'
import type { ItemEnvio } from './useFilaEnvio'

/** Fotos já tiradas com a situação do envio; as que falharam podem ser reenviadas. */
export function MiniaturasEnvio({ itens, onReenviar }: { itens: ItemEnvio[]; onReenviar: (i: ItemEnvio) => void }) {
  if (!itens.length) return null
  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {itens.map((i) => (
        <li key={i.id} className="relative overflow-hidden rounded-lg">
          <img src={i.preview} alt="" className="aspect-square w-full object-cover" />
          <span className="absolute right-1 top-1 rounded-full bg-white p-0.5">
            {i.status === 'enviando' ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : i.status === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
          </span>
          {i.status === 'erro' && (
            <button type="button" title={i.msg} onClick={() => onReenviar(i)}
              className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-rose-600/90 p-1 text-[10px] text-white">
              <RotateCcw className="h-3 w-3" />Reenviar
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
