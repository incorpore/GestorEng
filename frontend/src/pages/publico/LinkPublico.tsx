import { useEffect, useState } from 'react'
import { Building, Clock } from 'lucide-react'
import { Loading } from '@/components/ui'
import { applyBrandColor } from '@/core/format'
import { absUrl } from '@/core/platform'
import { publico } from './api'
import { Consentimento } from './Consentimento'
import { DiarioPublico } from './DiarioPublico'
import { EnvioFotos } from './EnvioFotos'

/** Página aberta pelo link público (/p/:token), sem login. */
export default function LinkPublico({ token }: { token: string }) {
  const [info, setInfo] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sessao, setSessao] = useState<{ s: string } | null>(null)
  const [conteudo, setConteudo] = useState<any>(null)

  useEffect(() => {
    publico.info(token).then((i) => { setInfo(i); if (i.empresa?.cor) applyBrandColor(i.empresa.cor); document.title = `${i.titulo} · ${i.empresa?.nome || ''}` })
      .catch((e) => setErro(e.message))
  }, [token])
  useEffect(() => {
    if (sessao) publico.conteudo(token, sessao.s).then(setConteudo).catch((e) => setErro(e.message))
  }, [sessao, token])

  return (
    <div className="min-h-full bg-slate-100 dark:bg-slate-950">
      <header className="safe-top bg-primary text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {info?.empresa?.tem_logo ? <img src={absUrl('/api/publico/logo')} alt="" className="h-10 rounded bg-white p-1" /> : <Building className="h-8 w-8" />}
          <div className="min-w-0"><p className="truncate font-semibold">{info?.titulo || 'Carregando...'}</p>
            <p className="truncate text-xs text-white/80">{info?.obra?.nome}{info?.obra?.cidade && ` · ${info.obra.cidade}/${info.obra.uf}`}</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4">
        {erro ? <div className="rounded-xl bg-white p-6 text-center dark:bg-slate-900"><Clock className="mx-auto mb-2 h-10 w-10 text-slate-300" /><p className="font-medium">{erro}</p>
          <p className="mt-1 text-sm text-slate-500">Peça um novo link a quem enviou.</p></div>
          : !info ? <Loading />
          : !sessao ? <Consentimento token={token} info={info} onSessao={(s) => setSessao({ s })} />
          : !conteudo ? <Loading />
          : conteudo.tipo === 'fotos' ? <EnvioFotos token={token} sessao={sessao.s} limite={conteudo.max_fotos} jaEnviadas={conteudo.enviadas} />
          : conteudo.tipo === 'diario' ? <DiarioPublico token={token} sessao={sessao.s} dados={conteudo} /> : null}
        <p className="mt-8 text-center text-[11px] text-slate-400">{info?.empresa?.nome} · Struvia</p>
      </main>
    </div>
  )
}
