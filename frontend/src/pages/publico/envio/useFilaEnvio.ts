import { useRef, useState, type MutableRefObject } from 'react'
import type { Coordenadas } from '@/core/geo'
import { publico } from '../api'

export interface ItemEnvio { id: number; preview: string; blob: Blob; captura: 'camera' | 'arquivo'; status: 'enviando' | 'ok' | 'erro'; msg?: string }

/** Fila de envio: cada foto sobe logo após ser tirada, uma de cada vez, com a localização atual. */
export function useFilaEnvio(token: string, sessao: string, posicao: MutableRefObject<Coordenadas | null>) {
  const fila = useRef<Promise<void>>(Promise.resolve())
  const seq = useRef(0)
  const [itens, setItens] = useState<ItemEnvio[]>([])
  const atualizar = (id: number, campos: Partial<ItemEnvio>) => setItens((s) => s.map((i) => (i.id === id ? { ...i, ...campos } : i)))

  function enviar(item: ItemEnvio) {
    fila.current = fila.current.then(async () => {
      const fd = new FormData()
      fd.append('arquivo', item.blob, `foto-${Date.now()}.jpg`); fd.append('sessao', sessao); fd.append('captura', item.captura)
      const g = posicao.current
      if (g) { fd.append('latitude', String(g.latitude)); fd.append('longitude', String(g.longitude)); if (g.precisao) fd.append('precisao', String(g.precisao)) }
      try { await publico.enviarFoto(token, fd); atualizar(item.id, { status: 'ok', msg: undefined }) } catch (e: any) { atualizar(item.id, { status: 'erro', msg: e.message }) }
    })
  }

  function adicionar(blob: Blob, captura: 'camera' | 'arquivo') {
    const item: ItemEnvio = { id: ++seq.current, preview: URL.createObjectURL(blob), blob, captura, status: 'enviando' }
    setItens((s) => [item, ...s])
    enviar(item)
  }

  function reenviar(item: ItemEnvio) { atualizar(item.id, { status: 'enviando' }); enviar(item) }

  return {
    itens, adicionar, reenviar, aguardar: () => fila.current,
    enviadas: itens.filter((i) => i.status === 'ok').length,
    pendentes: itens.filter((i) => i.status === 'enviando').length,
  }
}
