import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { DatabaseBackup, PlugZap } from 'lucide-react'
import { Badge, Button, Card, Field, Input, Loading, Toggle } from '@/components/ui'
import { api } from '@/core/api'
import { bytes, dataHora } from '@/core/format'
import { errMsg, useToast } from '@/core/toast'

/** Backup automático (banco + arquivos) para S3 compatível: AWS, MinIO, R2, B2, Wasabi... */
export function Backup() {
  const qc = useQueryClient()
  const toast = useToast()
  const cfg = useQuery({ queryKey: ['backup-cfg'], queryFn: () => api.get('/backup/config') })
  const hist = useQuery({ queryKey: ['backup-hist'], queryFn: () => api.get('/backup/historico'), refetchInterval: 10_000 })
  const [v, setV] = useState<any>(null)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { if (cfg.data) setV(cfg.data) }, [cfg.data])
  if (!v) return <Loading />
  const set = (k: string, x: any) => setV({ ...v, [k]: x })
  const run = async (k: string, fn: () => Promise<any>, ok: string) => {
    setBusy(k)
    try { await fn(); toast(ok); qc.invalidateQueries({ queryKey: ['backup-cfg'] }); qc.invalidateQueries({ queryKey: ['backup-hist'] }) } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(null) }
  }
  const txt = (k: string, l: string, ph?: string) => <Field label={l}><Input value={v[k] ?? ''} placeholder={ph} onChange={(e) => set(k, e.target.value)} /></Field>
  const { secret_definido: _s, ...body } = v

  return (
    <div className="space-y-4">
      <Card title="Backup em S3 compatível" actions={<>
        <Button size="sm" variant="secondary" icon={<PlugZap className="h-4 w-4" />} loading={busy === 't'} onClick={() => run('t', () => api.post('/backup/testar'), 'Bucket acessível')}>Testar</Button>
        <Button size="sm" variant="secondary" icon={<DatabaseBackup className="h-4 w-4" />} loading={busy === 'x'} onClick={() => run('x', () => api.post('/backup/executar'), 'Backup iniciado')}>Executar agora</Button>
        <Button size="sm" loading={busy === 's'} onClick={() => run('s', () => api.put('/backup/config', { ...body, secret_key: secret || undefined }).then(() => setSecret('')), 'Configuração salva')}>Salvar</Button>
      </>}>
        <div className="space-y-4">
          <Toggle checked={!!v.ativo} onChange={(x) => set('ativo', x)} label="Backup diário automático" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {txt('endpoint_url', 'Endpoint', 'https://s3.amazonaws.com ou http://minio:9000')}{txt('regiao', 'Região')}
            {txt('bucket', 'Bucket')}{txt('prefixo', 'Prefixo (pasta)')}
            {txt('access_key', 'Access key')}
            <Field label="Secret key" hint={v.secret_definido ? 'Definida (em branco mantém)' : 'Armazenada criptografada'}>
              <Input type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={v.secret_definido ? '••••••••' : ''} />
            </Field>
            <Field label="Horário (hora)"><Input type="number" min={0} max={23} value={v.hora} onChange={(e) => set('hora', Number(e.target.value))} /></Field>
            <Field label="Minuto"><Input type="number" min={0} max={59} value={v.minuto} onChange={(e) => set('minuto', Number(e.target.value))} /></Field>
            <Field label="Retenção (dias)" hint="0 = manter todos"><Input type="number" min={0} value={v.retencao_dias} onChange={(e) => set('retencao_dias', Number(e.target.value))} /></Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <Toggle checked={!!v.incluir_arquivos} onChange={(x) => set('incluir_arquivos', x)} label="Incluir anexos e PDFs" />
            <Toggle checked={!!v.path_style} onChange={(x) => set('path_style', x)} label="Path-style (MinIO)" />
            <Toggle checked={!!v.sse} onChange={(x) => set('sse', x)} label="Criptografia no servidor (SSE-AES256)" />
          </div>
        </div>
      </Card>
      <Card title="Histórico" padded={false}>
        {hist.isLoading ? <Loading /> : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {(hist.data || []).map((b: any) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>{dataHora(b.iniciado_em)} <Badge tone={b.status === 'sucesso' ? 'green' : b.status === 'erro' ? 'red' : 'yellow'}>{b.status}</Badge> <span className="text-xs text-slate-400">{b.origem}</span></span>
                <span className="max-w-full truncate text-xs text-slate-500">{b.chave} {b.tamanho ? `· ${bytes(b.tamanho)}` : ''} {b.mensagem}</span>
              </li>
            ))}
            {!hist.data?.length && <li className="px-4 py-6 text-center text-slate-400">Nenhum backup ainda</li>}
          </ul>
        )}
      </Card>
    </div>
  )
}
