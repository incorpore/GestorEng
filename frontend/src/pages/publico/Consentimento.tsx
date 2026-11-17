import { useState } from 'react'
import { MapPin, ShieldCheck } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { GEO_MSG, obterLocalizacao } from '@/core/geo'
import { publico } from './api'

/** Aviso de registro (IP, aparelho, localização) e obtenção da localização antes de liberar o conteúdo. */
export function Consentimento({ token, info, onSessao }: { token: string; info: any; onSessao: (s: string, nome: string) => void }) {
  const [nome, setNome] = useState(() => { try { return localStorage.getItem('struvia-nome') || '' } catch { return '' } })
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pedeNome = info.tipo === 'fotos'

  async function continuar(semLocalizacao = false) {
    setBusy(true); setErro(null)
    try { localStorage.setItem('struvia-nome', nome) } catch { /* ignora */ }
    try {
      if (semLocalizacao) {
        const r = await publico.localizacao(token, { negada: true, motivo: 'usuario_optou', nome: nome || undefined })
        return onSessao(r.sessao, nome)
      }
      const g = await obterLocalizacao(15000)
      if (!g.ok) {
        await publico.localizacao(token, { negada: true, motivo: g.erro, nome: nome || undefined }).then((r) => onSessao(r.sessao, nome)).catch(() => null)
        setErro(GEO_MSG[g.erro])
        return
      }
      const r = await publico.localizacao(token, { ...g.coords, nome: nome || undefined })
      onSessao(r.sessao, nome)
    } catch (e: any) { setErro(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {info.instrucoes && <div className="rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-slate-900"><p className="whitespace-pre-line">{info.instrucoes}</p></div>}
      {pedeNome && <Field label="Seu nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como devemos identificar quem enviou" /></Field>}
      <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <p>Para segurança e registro da obra, este acesso registra <b>seu endereço IP, o aparelho/navegador, a data e a hora</b>
          {info.exige_localizacao ? <> e <b>a localização do aparelho</b>, que é obrigatória para continuar.</> : <> e, se você permitir, a localização do aparelho.</>}
          {' '}Os dados são usados apenas pela {info.empresa?.nome || 'empresa'} para controle da obra.</p>
      </div>
      {erro && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{erro}</p>}
      <Button className="w-full py-3 text-base" icon={<MapPin className="h-5 w-5" />} loading={busy} disabled={pedeNome && nome.trim().length < 2}
        onClick={() => continuar()}>{info.exige_localizacao ? 'Permitir localização e continuar' : 'Continuar'}</Button>
      {!info.exige_localizacao && <button className="w-full text-sm text-slate-500" onClick={() => continuar(true)}>Continuar sem compartilhar a localização</button>}
    </div>
  )
}
