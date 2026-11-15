import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, refreshSession, tokens } from './api'
import { isNative, secureStore } from './platform'

export interface Usuario {
  id: number; nome: string; email: string; superusuario: boolean; trocar_senha: boolean; totp_ativo: boolean
  cargo?: string | null; telefone?: string | null
}
export interface ModuloInfo { key: string; label: string; icon: string; order: number }
interface Me { usuario: Usuario; permissoes: string[]; modulos: ModuloInfo[] }

interface AuthCtx {
  user: Usuario | null
  perms: Set<string>
  modules: Set<string>
  loading: boolean
  can: (...codes: string[]) => boolean
  canAny: (...codes: string[]) => boolean
  login: (email: string, senha: string, codigo?: string) => Promise<'ok' | 'totp'>
  logout: () => Promise<void>
  reload: () => Promise<void>
  applyTokens: (data: { access_token: string; refresh_token?: string | null }) => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setMe(await api.get<Me>('/auth/me'))
    } catch {
      setMe(null)
    }
  }, [])

  const applyTokens = useCallback(async (data: { access_token: string; refresh_token?: string | null }) => {
    tokens.set(data.access_token)
    if (isNative && data.refresh_token) await secureStore.set('refresh_token', data.refresh_token)
  }, [])

  useEffect(() => {
    tokens.onUnauthorized(() => { tokens.set(null); setMe(null) })
    ;(async () => {
      if (await refreshSession()) await reload()
      setLoading(false)
    })()
  }, [reload])

  // renova o access token periodicamente enquanto o app está aberto
  useEffect(() => {
    if (!me) return
    const t = setInterval(() => { refreshSession() }, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [me])

  const login = useCallback(async (email: string, senha: string, codigo?: string) => {
    const data = await api.post('/auth/login', { email, senha, codigo_totp: codigo || undefined,
                                                  dispositivo: isNative ? 'App Android' : navigator.userAgent.slice(0, 180) })
    if (data.totp_required) return 'totp' as const
    await applyTokens(data)
    await reload()
    return 'ok' as const
  }, [applyTokens, reload])

  const logout = useCallback(async () => {
    try {
      const rt = await secureStore.get('refresh_token')
      await api.post('/auth/logout', isNative ? { refresh_token: rt } : undefined)
    } catch { /* ignora */ }
    await secureStore.set('refresh_token', null)
    tokens.set(null)
    setMe(null)
  }, [])

  const value = useMemo<AuthCtx>(() => {
    const perms = new Set(me?.permissoes || [])
    const su = !!me?.usuario.superusuario
    return {
      user: me?.usuario || null,
      perms,
      modules: new Set((me?.modulos || []).map((m) => m.key)),
      loading,
      can: (...codes) => su || codes.every((c) => perms.has(c)),
      canAny: (...codes) => su || codes.some((c) => perms.has(c)),
      login, logout, reload, applyTokens,
    }
  }, [me, loading, login, logout, reload, applyTokens])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fora do AuthProvider')
  return c
}

export function Can({ perm, any, children, fallback = null }: { perm?: string | string[]; any?: string[]; children: ReactNode; fallback?: ReactNode }) {
  const { can, canAny } = useAuth()
  const ok = (perm ? can(...(Array.isArray(perm) ? perm : [perm])) : true) && (any ? canAny(...any) : true)
  return <>{ok ? children : fallback}</>
}
