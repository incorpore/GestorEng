import { useEffect, useState } from 'react'

const KEY = 'struvia-theme'
function initial(): boolean {
  try {
    const s = localStorage.getItem(KEY)
    if (s) return s === 'dark'
  } catch { /* ignora */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function applyTheme(dark = initial()) {
  document.documentElement.classList.toggle('dark', dark)
}

export function useTheme() {
  const [dark, setDark] = useState(initial)
  useEffect(() => {
    applyTheme(dark)
    try { localStorage.setItem(KEY, dark ? 'dark' : 'light') } catch { /* ignora */ }
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}
