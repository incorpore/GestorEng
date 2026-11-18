import { useState, type RefObject } from 'react'
import { Loader2 } from 'lucide-react'

/** Visor da câmera ao vivo com o botão de disparo. */
export function VisorCamera({ video, iniciando, desabilitado, onFoto }: {
  video: RefObject<HTMLVideoElement>; iniciando: boolean; desabilitado: boolean; onFoto: () => void
}) {
  const [flash, setFlash] = useState(false)
  function disparar() {
    setFlash(true); setTimeout(() => setFlash(false), 150)
    navigator.vibrate?.(30)
    onFoto()
  }
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={video} playsInline muted autoPlay className="h-[58vh] max-h-[640px] w-full object-cover" />
      {flash && <div className="absolute inset-0 bg-white/80" />}
      {iniciando && <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Abrindo a câmera...</div>}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent pb-5 pt-10">
        <button type="button" aria-label="Tirar foto" onClick={disparar} disabled={desabilitado}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/30 shadow-lg transition active:scale-90 disabled:opacity-40">
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  )
}
