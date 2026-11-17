import { useState } from 'react'
import { Server } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { setServerUrl } from '@/core/platform'

/** Primeira execução do app Android: endereço do servidor (ex.: https://gestor.velmont.com.br ou http://192.168.0.10:8080). */
export default function ServerSetup({ onDone, initial = '' }: { onDone: () => void; initial?: string }) {
  const [url, setUrl] = useState(initial || 'https://')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)
    const base = url.trim().replace(/\/+$/, '')
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) throw new Error()
      await setServerUrl(base)
      onDone()
    } catch { setErro('Não foi possível conectar. Verifique o endereço e se o servidor está acessível desta rede.') } finally { setLoading(false) }
  }
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-2"><Server className="h-6 w-6 text-primary" /><h1 className="text-lg font-semibold">Conectar ao servidor</h1></div>
        <p className="text-sm text-slate-500">Informe o endereço do Struvia da sua empresa.</p>
        <Field label="Endereço do servidor"><Input type="url" inputMode="url" autoCapitalize="none" required value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
        {erro && <p className="text-sm text-rose-600">{erro}</p>}
        <Button className="w-full" type="submit" loading={loading}>Conectar</Button>
      </form>
    </div>
  )
}
