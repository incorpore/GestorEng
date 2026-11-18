import { useRef, useState } from 'react'
import { Camera, Send } from 'lucide-react'
import { Button, useConfirm } from '@/components/ui'
import { publico } from './api'
import { EnvioFinalizado } from './envio/EnvioFinalizado'
import { MiniaturasEnvio } from './envio/MiniaturasEnvio'
import { useCameraAoVivo } from './envio/useCameraAoVivo'
import { useFilaEnvio } from './envio/useFilaEnvio'
import { VisorCamera } from './envio/VisorCamera'

/** Fotos somente da câmera: cada foto é enviada logo após ser tirada; "Finalizar" encerra o link. */
export function EnvioFotos({ token, sessao, limite, jaEnviadas }: { token: string; sessao: string; limite?: number | null; jaEnviadas: number }) {
  const confirm = useConfirm()
  const entrada = useRef<HTMLInputElement>(null)
  const cam = useCameraAoVivo()
  const fila = useFilaEnvio(token, sessao, cam.posicao)
  const [finalizando, setFinalizando] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const enviadas = jaEnviadas + fila.enviadas
  const esgotado = !!limite && enviadas + fila.pendentes >= limite

  async function fotografar() {
    if (esgotado) return
    const foto = await cam.capturar()
    if (foto) fila.adicionar(foto, 'camera')
  }

  async function finalizar() {
    if (!(await confirm(fila.pendentes ? 'Ainda há fotos sendo enviadas. Aguardar o envio e finalizar?' : 'Finalizar o envio? O link será fechado e não poderá mais ser usado.', { title: 'Finalizar envio', ok: 'Finalizar' }))) return
    setFinalizando(true)
    await fila.aguardar()
    try {
      const r = await publico.finalizar(token, sessao)
      cam.parar()
      setTotal(r.fotos)
    } catch (e: any) { cam.setAviso(e.message) } finally { setFinalizando(false) }
  }

  if (total !== null) return <EnvioFinalizado total={total} />

  return (
    <div className="space-y-3">
      {cam.modo !== 'arquivo' ? (
        <VisorCamera video={cam.video} iniciando={cam.modo === 'iniciando'} desabilitado={cam.modo !== 'camera' || esgotado || finalizando} onFoto={fotografar} />
      ) : (
        <>
          <input ref={entrada} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) fila.adicionar(f, 'arquivo'); e.target.value = '' }} />
          <Button className="h-28 w-full flex-col text-base" disabled={esgotado} onClick={() => entrada.current?.click()} icon={<Camera className="h-8 w-8" />}>Tirar foto</Button>
        </>
      )}
      {cam.aviso && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">{cam.aviso}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <b>{enviadas}</b> enviada(s){limite ? ` de ${limite}` : ''}{fila.pendentes ? ` · ${fila.pendentes} enviando...` : ''}{esgotado && !fila.pendentes ? ' — limite atingido' : ''}
        </p>
        <Button onClick={finalizar} loading={finalizando} disabled={enviadas + fila.pendentes === 0} icon={<Send className="h-4 w-4" />}>Finalizar</Button>
      </div>

      <MiniaturasEnvio itens={fila.itens} onReenviar={fila.reenviar} />
      <p className="text-center text-xs text-slate-500">As fotos são enviadas automaticamente com data, hora e localização. Ao terminar, toque em <b>Finalizar</b>.</p>
    </div>
  )
}
