import { useState } from 'react'
import QRCode from 'qrcode'
import { ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, Field, Input } from '@/components/ui'
import { api } from '@/core/api'
import { useAuth } from '@/core/auth'
import { errMsg, useToast } from '@/core/toast'

export function DoisFatores() {
  const { user, reload } = useAuth()
  const toast = useToast()
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  async function iniciar() {
    try { const r = await api.post('/auth/2fa/configurar'); setSetup({ secret: r.secret, qr: await QRCode.toDataURL(r.otpauth_uri, { margin: 1, width: 200 }) }) } catch (e) { toast(errMsg(e), 'error') }
  }
  async function ativar() {
    try { await api.post('/auth/2fa/ativar', { codigo }); toast('2FA ativado'); setSetup(null); reload() } catch (e) { toast(errMsg(e), 'error') }
  }
  async function desativar() {
    try { await api.post('/auth/2fa/desativar', { senha }); toast('2FA desativado'); setSenha(''); reload() } catch (e) { toast(errMsg(e), 'error') }
  }
  return (
    <Card title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Verificação em duas etapas {user?.totp_ativo ? <Badge tone="green">ativa</Badge> : <Badge>inativa</Badge>}</span>}>
      {user?.totp_ativo ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Confirme sua senha para desativar"><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
          <Button variant="danger" onClick={desativar} disabled={!senha}>Desativar</Button>
        </div>
      ) : setup ? (
        <div className="flex flex-col gap-4 sm:flex-row">
          <img src={setup.qr} alt="QR code 2FA" className="h-48 w-48 rounded border border-slate-200 bg-white" />
          <div className="space-y-2 text-sm">
            <p>Escaneie com Google Authenticator, Microsoft Authenticator, Aegis ou 1Password.</p>
            <p className="text-xs text-slate-500">Chave manual: <code className="break-all">{setup.secret}</code></p>
            <Field label="Código de 6 dígitos"><Input inputMode="numeric" maxLength={8} value={codigo} onChange={(e) => setCodigo(e.target.value)} /></Field>
            <Button onClick={ativar} disabled={codigo.length < 6}>Ativar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2"><p className="text-sm text-slate-500">Protege sua conta exigindo um código do celular além da senha.</p><Button onClick={iniciar}>Configurar</Button></div>
      )}
    </Card>
  )
}
