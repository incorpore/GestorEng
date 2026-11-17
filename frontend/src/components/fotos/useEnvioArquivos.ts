import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/core/api'
import { GEO_MSG, obterLocalizacao } from '@/core/geo'
import { errMsg, useToast } from '@/core/toast'

/** Entidades cujas fotos recebem marca d'água: enviamos a localização do aparelho junto (se houver). */
export const ENTIDADES_FOTO = new Set(['obra', 'diario', 'medicao'])

export function useEnvioArquivos(entidade: string, entidadeId: number) {
  const qc = useQueryClient()
  const toast = useToast()
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null)

  async function enviar(files: FileList | File[] | null, descricao?: string) {
    const lista = Array.from(files || [])
    if (!lista.length) return
    let coords: { latitude: number; longitude: number } | null = null
    if (ENTIDADES_FOTO.has(entidade) && lista.some((f) => f.type.startsWith('image/'))) {
      const r = await obterLocalizacao(8000)
      if (r.ok) coords = r.coords
      else toast(`${GEO_MSG[r.erro]} Será usada a localização da foto (GPS) ou da obra.`, 'info')
    }
    try {
      for (let i = 0; i < lista.length; i++) {
        setEnviando({ atual: i + 1, total: lista.length })
        const fd = new FormData()
        fd.append('arquivo', lista[i])
        fd.append('entidade', entidade)
        fd.append('entidade_id', String(entidadeId))
        if (descricao) fd.append('descricao', descricao)
        if (coords) { fd.append('latitude', String(coords.latitude)); fd.append('longitude', String(coords.longitude)) }
        await api.post('/arquivos', fd)
      }
      toast(lista.length > 1 ? `${lista.length} arquivos enviados` : 'Arquivo enviado')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setEnviando(null)
      qc.invalidateQueries({ queryKey: ['arquivos', entidade, entidadeId] })
    }
  }
  return { enviar, enviando }
}
