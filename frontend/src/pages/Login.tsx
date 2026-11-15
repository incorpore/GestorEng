import { useState } from 'react'
import { KeyRound, Server } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { Brand } from '@/components/layout/Brand'
import { useAuth } from '@/core/auth'
import { getServerUrl, isNative } from '@/core/platform'
import { errMsg } from '@/core/toast'

export default function Login({ onChangeServer }: { onChangeServer?: () => void }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [totp, setTotp] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try { if ((await login(email.trim(), senha, totp ? codigo : undefined)) === 'totp') setTotp(true) }
    catch (err) { setErro(errMsg(err)) } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-primary-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Brand big /></div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <h1 className="text-lg font-semibold">{totp ? 'Verificação em duas etapas' : 'Acessar o sistema'}</h1>
          {!totp ? <>
            <Field label="E-mail"><Input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Senha"><Input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
          </> : (
            <Field label="Código do aplicativo autenticador"><Input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={8} value={codigo} onChange={(e) => setCodigo(e.target.value)} /></Field>
          )}
          {erro && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{erro}</p>}
          <Button type="submit" className="w-full" loading={loading} icon={<KeyRound className="h-4 w-4" />}>Entrar</Button>
          {totp && <button type="button" className="w-full text-xs text-slate-500" onClick={() => { setTotp(false); setCodigo('') }}>Voltar</button>}
        </form>
        {isNative && <button onClick={onChangeServer} className="mx-auto mt-4 flex items-center gap-1 text-xs text-slate-500"><Server className="h-3.5 w-3.5" />{getServerUrl()} · trocar servidor</button>}
      </div>
    </div>
  )
}
