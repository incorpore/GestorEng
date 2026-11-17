import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui'
import { api } from '@/core/api'
import { isNative } from '@/core/platform'

/** Documento gerado pelo sistema (diário, cartilha): mostra o progresso ou o PDF. */
export function PdfGerado({ doc }: { doc: any }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (doc.status === 'gerando' || doc.status === 'erro' || isNative) return
    let u: string | null = null
    api.blob(`/documentos-acoes/${doc.id}/pdf`).then((b) => { u = URL.createObjectURL(b); setUrl(u) }).catch(() => null)
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [doc.id, doc.status, doc.pdf_assinado_id])
  const info = doc.variaveis || {}
  if (doc.status === 'gerando') return (
    <Card><div className="flex flex-col items-center gap-3 py-12 text-center"><Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="font-medium">Gerando o PDF...</p><p className="text-sm text-slate-500">{info._progresso || 'Aguarde'} — com muitas fotos pode levar alguns minutos. Você pode sair desta tela.</p></div></Card>
  )
  if (doc.status === 'erro') return (
    <Card><div className="flex flex-col items-center gap-2 py-10 text-center"><AlertTriangle className="h-10 w-10 text-rose-500" />
      <p className="font-medium">Não foi possível gerar o documento</p><p className="text-sm text-slate-500">{info._progresso}</p></div></Card>
  )
  return (
    <Card padded={false}>
      {info._paginas && <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">{info._paginas} página(s){doc.tipo === 'cartilha' && info._parametros?.formato === 'livreto' ? ' — livreto: imprima frente e verso virando na borda curta, dobre ao meio e grampeie' : ''}</p>}
      {url ? <iframe title="PDF" src={url} className="h-[78vh] w-full rounded-b-xl" /> : <p className="p-6 text-center text-sm text-slate-500">Use "Abrir PDF" para visualizar.</p>}
    </Card>
  )
}
