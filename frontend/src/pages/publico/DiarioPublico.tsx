import { useState } from 'react'
import { FileDown, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { ClimaVisual } from '@/modules/diario/components/ClimaVisual'
import { Indicadores } from '@/modules/diario/components/Indicadores'
import { SecaoVisual } from '@/modules/diario/components/SecaoVisual'
import { SECOES } from '@/modules/diario/secoes'
import { publico } from './api'

/** Leitura pública do diário (somente leitura) com fotos e PDF. */
export function DiarioPublico({ token, sessao, dados }: { token: string; sessao: string; dados: any }) {
  const d = dados.diario
  const [aberta, setAberta] = useState<number | null>(null)
  const dt = new Date(d.data + 'T12:00')
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-xs uppercase tracking-widest text-white/60">{dt.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
        <h2 className="text-3xl font-bold">{dt.toLocaleDateString('pt-BR')}</h2>
        <p className="text-sm text-white/70">RDO nº {String(d.numero).padStart(4, '0')} · {d.responsavel}</p>
        <a href={publico.pdfUrl(token, sessao)} target="_blank" rel="noopener noreferrer"><Button className="mt-3" variant="secondary" icon={<FileDown className="h-4 w-4" />}>Baixar PDF</Button></a>
      </div>
      <Indicadores equipe={d.total_efetivo} servicos={d.media_servicos} fotos={dados.fotos.length} pendencias={d.pendencias_abertas} />
      {dados.fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dados.fotos.map((f: any, i: number) => (
            <button key={f.id} onClick={() => setAberta(i)} className="overflow-hidden rounded-xl bg-slate-200">
              <img src={publico.fotoUrl(token, sessao, f.id)} alt={f.descricao || ''} loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <ClimaVisual detalhe={d.clima_detalhe} manha={d.clima_manha} tarde={d.clima_tarde} condicao={d.condicao} />
      {SECOES.map((s) => <SecaoVisual key={s.chave} def={s} itens={d[s.chave]} />)}
      {d.observacoes && <div className="card p-4 text-sm"><b className="mb-1 block">Observações</b><p className="whitespace-pre-line">{d.observacoes}</p></div>}
      {aberta !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setAberta(null)}>
          <button className="self-end p-4 text-white" aria-label="Fechar"><X className="h-6 w-6" /></button>
          <img src={publico.fotoUrl(token, sessao, dados.fotos[aberta].id)} alt="" className="m-auto max-h-[85vh] max-w-full object-contain" />
          {dados.fotos[aberta].descricao && <p className="p-4 text-center text-white">{dados.fotos[aberta].descricao}</p>}
        </div>
      )}
    </div>
  )
}
