export interface Coordenadas { latitude: number; longitude: number; precisao?: number }
export type GeoErro = 'inseguro' | 'negada' | 'indisponivel' | 'tempo'

/** Localização do aparelho. Navegadores só liberam em páginas HTTPS (ou localhost). */
export function obterLocalizacao(timeoutMs = 10000): Promise<{ ok: true; coords: Coordenadas } | { ok: false; erro: GeoErro }> {
  return new Promise((resolve) => {
    if (!window.isSecureContext) return resolve({ ok: false, erro: 'inseguro' })
    if (!('geolocation' in navigator)) return resolve({ ok: false, erro: 'indisponivel' })
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok: true, coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, precisao: p.coords.accuracy } }),
      (e) => resolve({ ok: false, erro: e.code === e.PERMISSION_DENIED ? 'negada' : e.code === e.TIMEOUT ? 'tempo' : 'indisponivel' }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    )
  })
}

export const GEO_MSG: Record<GeoErro, string> = {
  inseguro: 'O navegador só libera a localização em conexões seguras (HTTPS).',
  negada: 'A permissão de localização foi negada. Libere nas configurações do navegador.',
  indisponivel: 'Não foi possível obter a localização deste aparelho.',
  tempo: 'A localização demorou demais para responder. Tente novamente em local aberto.',
}

export const linkMapa = (lat: number, lon: number) => `https://www.google.com/maps?q=${lat},${lon}`
