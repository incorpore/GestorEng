import { absUrl, isNative, secureStore } from './platform'

export class ApiError extends Error {
  status: number
  erros?: { campo: string; mensagem: string }[]
  constructor(status: number, message: string, erros?: ApiError['erros']) {
    super(message)
    this.status = status
    this.erros = erros
  }
}

let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
let onUnauthorized: (() => void) | null = null

export const tokens = {
  set(t: string | null) { accessToken = t },
  get() { return accessToken },
  onUnauthorized(cb: () => void) { onUnauthorized = cb },
}

function headers(extra?: HeadersInit, json = true): Headers {
  const h = new Headers(extra)
  if (json && !h.has('Content-Type')) h.set('Content-Type', 'application/json')
  if (accessToken) h.set('Authorization', `Bearer ${accessToken}`)
  if (isNative) h.set('X-Client', 'mobile')
  return h
}

export async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const body = isNative ? JSON.stringify({ refresh_token: await secureStore.get('refresh_token') }) : undefined
      if (isNative && !(await secureStore.get('refresh_token'))) return false
      const r = await fetch(absUrl('/api/auth/refresh'), {
        method: 'POST', credentials: 'include', headers: headers(undefined, true), body,
      })
      if (!r.ok) return false
      const data = await r.json()
      accessToken = data.access_token
      if (isNative && data.refresh_token) await secureStore.set('refresh_token', data.refresh_token)
      return true
    } catch {
      return false
    } finally {
      setTimeout(() => (refreshing = null), 0)
    }
  })()
  return refreshing
}

async function parseError(r: Response): Promise<ApiError> {
  let msg = `Erro ${r.status}`
  let erros
  try {
    const data = await r.json()
    if (typeof data.detail === 'string') msg = data.detail
    erros = data.erros
  } catch { /* corpo vazio */ }
  if (r.status === 0 || r.status >= 500) msg = msg === `Erro ${r.status}` ? 'Erro no servidor. Tente novamente.' : msg
  return new ApiError(r.status, msg, erros)
}

export async function request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const isForm = init.body instanceof FormData
  let r: Response
  try {
    r = await fetch(absUrl(`/api${path}`), { credentials: 'include', ...init, headers: headers(init.headers, !isForm) })
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor')
  }
  if (r.status === 401 && retry && !path.startsWith('/auth/login')) {
    if (await refreshSession()) return request(path, init, false)
    onUnauthorized?.()
  }
  if (!r.ok) throw await parseError(r)
  return r
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await request(path, init)
  if (r.status === 204) return undefined as T
  return r.json()
}

function qs(params?: Record<string, unknown>) {
  if (!params) return ''
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.append(k, String(v))
  })
  const str = s.toString()
  return str ? `?${str}` : ''
}

export const api = {
  get: <T = any>(path: string, params?: Record<string, unknown>) => json<T>(path + qs(params)),
  post: <T = any>(path: string, body?: unknown) =>
    json<T>(path, { method: 'POST', body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) }),
  put: <T = any>(path: string, body?: unknown) => json<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T = any>(path: string, body?: unknown) => json<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T = any>(path: string) => json<T>(path, { method: 'DELETE' }),
  blob: async (path: string, init?: RequestInit) => (await request(path, init)).blob(),
}

export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
