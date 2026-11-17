import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Loader2, RotateCcw, Send, XCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import type { Coordenadas } from '@/core/geo'
import { publico } from './api'

interface Item { id: number; preview: string; blob: Blob; captura: 'camera' | 'arquivo'; status: 'enviando' | 'ok' | 'erro'; msg?: string }
type Modo = 'iniciando' | 'camera' | 'arquivo' | 'finalizando' | 'fim'

/** Fotos somente da câmera: cada foto é enviada logo após ser tirada; "Finalizar" encerra o link. */
export function EnvioFotos({ token, sessao, limite, jaEnviadas }: { token: string; sessao: string; limite?: number | null; jaEnviadas: number }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const posicao = useRef<Coordenadas | null>(null)
  const fila = useRef<Promise<void>>(Promise.resolve())
  const seq = useRef(0)
  const [modo, setModo] = useState<Modo>('iniciando')
  const [aviso, setAviso] = useState<string | null>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [flash, setFlash] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const enviadas = jaEnviadas + itens.filter((i) => i.status === 'ok').length
  const pendentes = itens.filter((i) => i.status === 'enviando').length
  const esgotado = !!limite && enviadas + pendentes >= limite

  // câmera ao vivo dentro da página (não dá acesso à galeria)
  useEffect(() => {
    let cancelado = false
    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setAviso(window.isSecureContext ? 'Este navegador não permite abrir a câmera dentro da página.' : 'A câmera dentro da página exige conexão segura (HTTPS).')
        return setModo('arquivo')
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } } })
        if (cancelado) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => null) }
        setModo('camera')
      } catch {
        setAviso('Não foi possível abrir a câmera. Permita o acesso à câmera nas configurações do navegador e recarregue a página.')
        setModo('arquivo')
      }
    }
    iniciar()
    let watch: number | undefined
    if (window.isSecureContext && 'geolocation' in navigator) {
      watch = navigator.geolocation.watchPosition((p) => { posicao.current = { latitude: p.coords.latitude, longitude: p.coords.longitude, precisao: p.coords.accuracy } },
        () => null, { enableHighAccuracy: true, maximumAge: 15000 })
    }
    return () => { cancelado = true; stream.current?.getTracks().forEach((t) => t.stop()); if (watch !== undefined) navigator.geolocation.clearWatch(watch) }
  }, [])

  function atualizar(id: number, campos: Partial<Item>) {
    setItens((s) => s.map((i) => (i.id === id ? { ...i, ...campos } : i)))
  }

  function enviar(item: Item) {
    fila.current = fila.current.then(async () => {
      const fd = new FormData()
      fd.append('arquivo', item.blob, `foto-${Date.now()}.jpg`); fd.append('sessao', sessao); fd.append('captura', item.captura)
      const g = posicao.current
      if (g) { fd.append('latitude', String(g.latitude)); fd.append('longitude', String(g.longitude)); if (g.precisao) fd.append('precisao', String(g.precisao)) }
      try { await publico.enviarFoto(token, fd); atualizar(item.id, { status: 'ok', msg: undefined }) } catch (e: any) { atualizar(item.id, { status: 'erro', msg: e.message }) }
    })
  }

  function adicionar(blob: Blob, captura: 'camera' | 'arquivo') {
    const item: Item = { id: ++seq.current, preview: URL.createObjectURL(blob), blob, captura, status: 'enviando' }
    setItens((s) => [item, ...s])
    enviar(item)
  }

  function fotografar() {
    const v = video.current
    if (!v || !v.videoWidth || esgotado) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    setFlash(true); setTimeout(() => setFlash(false), 150)
    navigator.vibrate?.(30)
    c.toBlob((b) => b && adicionar(b, 'camera'), 'image/jpeg', 0.9)
  }

  async function finalizar() {
    if (!confirm(pendentes ? 'Ainda há fotos sendo enviadas. Aguardar o envio e finalizar?' : 'Finalizar o envio? O link será fechado e não poderá mais ser usado.')) return
    setModo('finalizando')
    await fila.current
    try {
      const r = await publico.finalizar(token, sessao)
      stream.current?.getTracks().forEach((t) => t.stop())
      setTotal(r.fotos); setModo('fim')
    } catch (e: any) { setAviso(e.message); setModo(stream.current ? 'camera' : 'arquivo') }
  }

  if (modo === 'fim') {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-slate-900">
        <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-emerald-600" />
        <p className="text-lg font-semibold">Envio finalizado</p>
        <p className="mt-1 text-sm text-slate-500">{total ?? enviadas} foto(s) recebida(s). Obrigado! Este link foi encerrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {modo !== 'arquivo' ? (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={video} playsInline muted autoPlay className="h-[58vh] max-h-[640px] w-full object-cover" />
          {flash && <div className="absolute inset-0 bg-white/80" />}
          {modo === 'iniciando' && <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Abrindo a câmera...</div>}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent pb-5 pt-10">
            <button type="button" aria-label="Tirar foto" onClick={fotografar} disabled={modo !== 'camera' || esgotado}
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/30 shadow-lg transition active:scale-90 disabled:opacity-40">
              <span className="h-14 w-14 rounded-full bg-white" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <input ref={entrada} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) adicionar(f, 'arquivo'); e.target.value = '' }} />
          <Button className="h-28 w-full flex-col text-base" disabled={esgotado} onClick={() => entrada.current?.click()} icon={<Camera className="h-8 w-8" />}>Tirar foto</Button>
        </>
      )}
      {aviso && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">{aviso}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <b>{enviadas}</b> enviada(s){limite ? ` de ${limite}` : ''}{pendentes ? ` · ${pendentes} enviando...` : ''}{esgotado && !pendentes ? ' — limite atingido' : ''}
        </p>
        <Button onClick={finalizar} loading={modo === 'finalizando'} disabled={enviadas + pendentes === 0} icon={<Send className="h-4 w-4" />}>Finalizar</Button>
      </div>

      {itens.length > 0 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {itens.map((i) => (
            <li key={i.id} className="relative overflow-hidden rounded-lg">
              <img src={i.preview} alt="" className="aspect-square w-full object-cover" />
              <span className="absolute right-1 top-1 rounded-full bg-white p-0.5">
                {i.status === 'enviando' ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : i.status === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
              </span>
              {i.status === 'erro' && (
                <button type="button" title={i.msg} onClick={() => { atualizar(i.id, { status: 'enviando' }); enviar(i) }}
                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-rose-600/90 p-1 text-[10px] text-white">
                  <RotateCcw className="h-3 w-3" />Reenviar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-center text-xs text-slate-500">As fotos são enviadas automaticamente com data, hora e localização. Ao terminar, toque em <b>Finalizar</b>.</p>
    </div>
  )
}
