const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 })

export const moeda = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : brl.format(Number(v)))
export const numero = (v: unknown, casas?: number) =>
  v === null || v === undefined || v === '' ? '—'
    : casas !== undefined ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
    : num.format(Number(v))

export function data(v: unknown) {
  if (!v) return '—'
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
  }
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? s : dt.toLocaleDateString('pt-BR')
}

export function dataHora(v: unknown) {
  if (!v) return '—'
  const dt = new Date(String(v))
  return isNaN(dt.getTime()) ? String(v) : dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const bytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`

export function hexToRgb(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : null
}

export function applyBrandColor(hex?: string | null) {
  const rgb = hexToRgb(hex || '')
  if (!rgb) return
  const [r, g, b] = rgb.split(' ').map(Number)
  document.documentElement.style.setProperty('--primary', rgb)
  document.documentElement.style.setProperty('--primary-dark', `${Math.round(r * 0.8)} ${Math.round(g * 0.8)} ${Math.round(b * 0.8)}`)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex!)
}
