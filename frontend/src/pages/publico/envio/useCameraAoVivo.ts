import { useEffect, useRef, useState } from 'react'
import type { Coordenadas } from '@/core/geo'

export type ModoCamera = 'iniciando' | 'camera' | 'arquivo'

/** Abre a câmera traseira dentro da página (sem galeria) e acompanha a localização do aparelho.
 *  Sem suporte (ou sem HTTPS) cai para o modo "arquivo", que abre o app de câmera do celular. */
export function useCameraAoVivo() {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const posicao = useRef<Coordenadas | null>(null)
  const [modo, setModo] = useState<ModoCamera>('iniciando')
  const [aviso, setAviso] = useState<string | null>(null)

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

  /** Captura o quadro atual do vídeo como JPEG. */
  function capturar(): Promise<Blob | null> {
    const v = video.current
    if (!v || !v.videoWidth) return Promise.resolve(null)
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))
  }
  const parar = () => stream.current?.getTracks().forEach((t) => t.stop())

  return { video, posicao, modo, aviso, setAviso, capturar, parar, temCamera: () => !!stream.current }
}
