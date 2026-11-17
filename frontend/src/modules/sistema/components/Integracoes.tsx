import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { PlugZap } from 'lucide-react'
import { Badge, Button, Card, Field, Input, Loading } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'

function IntegracaoCard({ chave, titulo, descricao, dados, campos, testar, segredoLabel, webhook }: {
  chave: string; titulo: string; descricao: string; dados: any; campos: { k: string; l: string; ph?: string }[]
  testar: string; segredoLabel: string; webhook?: boolean
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [cfg, setCfg] = useState<any>(dados.config)
  const [segredo, setSegredo] = useState('')
  const [wh, setWh] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => setCfg(dados.config), [dados])

  async function run(k: string, fn: () => Promise<any>, ok: string) {
    setBusy(k)
    try { await fn(); toast(ok); qc.invalidateQueries({ queryKey: ['integracoes'] }) } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(null) }
  }
  return (
    <Card title={<span className="flex items-center gap-2">{titulo} {dados.segredo_definido ? <Badge tone="green">configurado</Badge> : <Badge>pendente</Badge>}</span>}
      actions={<>
        <Button size="sm" variant="secondary" icon={<PlugZap className="h-4 w-4" />} loading={busy === 't'} onClick={() => run('t', () => api.post(testar), 'Conexão OK')}>Testar</Button>
        <Button size="sm" loading={busy === 's'} onClick={() => run('s', () => api.put(`/integracoes/${chave}`, { config: cfg, segredo: segredo || undefined, webhook_secret: wh || undefined }).then(() => { setSegredo(''); setWh('') }), 'Integração salva')}>Salvar</Button>
      </>}>
      <p className="mb-3 text-sm text-slate-500">{descricao}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map((c) => <Field key={c.k} label={c.l}><Input value={cfg[c.k] || ''} placeholder={c.ph} onChange={(e) => setCfg({ ...cfg, [c.k]: e.target.value })} /></Field>)}
        <Field label={segredoLabel} hint={dados.segredo_definido ? 'Deixe em branco para manter o atual. Armazenado criptografado.' : 'Armazenado criptografado no servidor.'}>
          <Input type="password" autoComplete="off" value={segredo} onChange={(e) => setSegredo(e.target.value)} placeholder={dados.segredo_definido ? '••••••••' : ''} />
        </Field>
        {webhook && <Field label="Segredo do webhook" hint={`URL: ${location.origin}/api/webhooks/documenso — cabeçalho X-Documenso-Secret${cfg.webhook_secret_definido ? ' (definido)' : ''}`}>
          <Input type="password" autoComplete="off" value={wh} onChange={(e) => setWh(e.target.value)} placeholder={cfg.webhook_secret_definido ? '••••••••' : ''} />
        </Field>}
      </div>
    </Card>
  )
}

export function Integracoes() {
  const q = useQuery({ queryKey: ['integracoes'], queryFn: () => api.get('/integracoes') })
  if (q.isLoading || !q.data) return <Loading />
  return (
    <div className="space-y-4">
      <IntegracaoCard chave="openrouter" titulo="OpenRouter (IA)" dados={q.data.openrouter} testar="/ia/testar" segredoLabel="API key"
        descricao="Usado pelo Assistente IA e pela redação de documentos. Escolha qualquer modelo disponível no OpenRouter."
        campos={[{ k: 'base_url', l: 'URL da API' }, { k: 'modelo', l: 'Modelo padrão', ph: 'anthropic/claude-sonnet-4.5' }]} />
      <IntegracaoCard chave="documenso" titulo="Documenso (assinatura eletrônica)" dados={q.data.documenso} testar="/documentos-acoes/integracao/documenso/testar"
        segredoLabel="API token" webhook descricao="Instância self-hosted (ex.: no ZimaOS). Gere o token em Configurações > API Tokens do Documenso."
        campos={[{ k: 'base_url', l: 'URL do Documenso', ph: 'http://192.168.0.10:3000' }]} />
      <IntegracaoCard chave="openweather" titulo="OpenWeather (clima)" dados={q.data.openweather} testar="/clima/testar" segredoLabel="API key"
        descricao="Clima atual da obra e preenchimento automático das condições de manhã/tarde no diário. Crie a chave gratuita em openweathermap.org (pode levar até 2 h para ativar)."
        campos={[{ k: 'base_url', l: 'URL da API' }]} />
      <Card title="PNCP"><p className="text-sm text-slate-500">A API de consulta do PNCP é pública e não requer credenciais. Use Licitações › Buscar no PNCP.</p></Card>
    </div>
  )
}
