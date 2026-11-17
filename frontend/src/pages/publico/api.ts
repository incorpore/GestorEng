import { absUrl } from '@/core/platform'

/** Chamadas da página pública (sem login). */
async function req<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  let r: Response
  try {
    r = await fetch(absUrl(`/api/publico/l${caminho}`), { ...init, credentials: 'omit' })
  } catch {
    throw new Error('Sem conexão. Verifique a internet e tente novamente.')
  }
  if (!r.ok) {
    let msg = `Erro ${r.status}`
    try { msg = (await r.json()).detail || msg } catch { /* sem corpo */ }
    throw Object.assign(new Error(msg), { status: r.status })
  }
  return r.json()
}

export const publico = {
  info: (t: string) => req<any>(`/${t}`),
  localizacao: (t: string, body: Record<string, unknown>) =>
    req<{ sessao: string }>(`/${t}/localizacao`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  conteudo: (t: string, s: string) => req<any>(`/${t}/conteudo`, { headers: { 'X-Link-Sessao': s } }),
  finalizar: (t: string, sessao: string) =>
    req<{ fotos: number }>(`/${t}/finalizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessao }) }),
  enviarFoto: (t: string, fd: FormData) => req<any>(`/${t}/fotos`, { method: 'POST', body: fd }),
  fotoUrl: (t: string, s: string, id: number) => absUrl(`/api/publico/l/${t}/foto/${id}?s=${encodeURIComponent(s)}`),
  pdfUrl: (t: string, s: string) => absUrl(`/api/publico/l/${t}/pdf?s=${encodeURIComponent(s)}`),
}
