import { CheckCircle2 } from 'lucide-react'

/** Tela final depois de "Finalizar": o link já está encerrado. */
export function EnvioFinalizado({ total }: { total: number }) {
  return (
    <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-slate-900">
      <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-emerald-600" />
      <p className="text-lg font-semibold">Envio finalizado</p>
      <p className="mt-1 text-sm text-slate-500">{total} foto(s) recebida(s). Obrigado! Este link foi encerrado.</p>
    </div>
  )
}
