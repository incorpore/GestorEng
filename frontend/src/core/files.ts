import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { api } from './api'
import { absUrl, isNative } from './platform'

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

/** Abre/baixa um arquivo vindo da API (PDF etc.), funcionando no navegador e no app Android. */
export async function openBlob(blob: Blob, filename: string, download = false) {
  if (isNative) {
    const data = await blobToBase64(blob)
    const res = await Filesystem.writeFile({ path: filename.replace(/[^\w.\- ]/g, '_'), data, directory: Directory.Cache })
    await Share.share({ title: filename, url: res.uri, dialogTitle: 'Abrir / compartilhar' })
    return
  }
  const url = URL.createObjectURL(blob)
  if (download) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  } else {
    window.open(url, '_blank', 'noopener')
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function openApiFile(path: string, filename: string, download = false) {
  const blob = await api.blob(path)
  await openBlob(blob, filename, download)
}

export async function signedUrl(arquivoId: number): Promise<string> {
  const { url } = await api.get<{ url: string }>(`/arquivos/${arquivoId}/link`)
  return absUrl(url)
}
