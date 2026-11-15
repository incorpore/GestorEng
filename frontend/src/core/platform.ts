import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export const isNative = Capacitor.isNativePlatform()

let serverUrl: string | null = null

export async function loadServerUrl(): Promise<string | null> {
  if (!isNative) return ''
  const { value } = await Preferences.get({ key: 'server_url' })
  serverUrl = value
  return value
}

export async function setServerUrl(url: string) {
  serverUrl = url.replace(/\/+$/, '')
  await Preferences.set({ key: 'server_url', value: serverUrl })
}

export function getServerUrl() {
  return isNative ? serverUrl || '' : ''
}

/** Converte caminho relativo da API (/api/...) em URL absoluta quando no app. */
export function absUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `${getServerUrl()}${path}`
}

export const secureStore = {
  async get(key: string) {
    if (!isNative) return null
    return (await Preferences.get({ key })).value
  },
  async set(key: string, value: string | null) {
    if (!isNative) return
    if (value === null) await Preferences.remove({ key })
    else await Preferences.set({ key, value })
  },
}
