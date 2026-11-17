import { useState } from 'react'
import { Camera, Send } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { Attachments } from '@/components/resource/Attachments'
import { LinkPublicoModal } from '@/components/links/LinkPublicoModal'

/** Registro fotográfico do diário: tirar/enviar fotos (com marca d'água) e pedir fotos por link. */
export function FotosDiario({ diarioId, podeEditar }: { diarioId: number; podeEditar: boolean }) {
  const [pedir, setPedir] = useState(false)
  return (
    <Card title={<span className="flex items-center gap-2"><span className="rounded-lg bg-violet-100 p-1.5 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"><Camera className="h-4 w-4" /></span>Registro fotográfico</span>}
      actions={podeEditar && <Button size="sm" variant="secondary" icon={<Send className="h-4 w-4" />} onClick={() => setPedir(true)}>Pedir foto</Button>}>
      <Attachments entidade="diario" entidadeId={diarioId} canEdit={podeEditar} somenteFotos />
      <LinkPublicoModal entidade="diario" entidadeId={diarioId} tipoInicial="fotos" open={pedir} onClose={() => setPedir(false)} />
    </Card>
  )
}
