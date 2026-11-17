import { useRef, useState } from 'react'
import { Camera, CheckCircle2, ImagePlus, Loader2, XCircle } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { obterLocalizacao } from '@/core/geo'
import { publico } from './api'

interface Item { nome: string; preview: string; status: 'enviando' | 'ok' | 'erro'; msg?: string }

/** Envio de fotos pelo link: cada foto vai com a localização atual do aparelho e o nome de quem enviou. */
export function EnvioFotos({ token, sessao, nome, limite, jaEnviadas }: { token: string; sessao: string; nome: string; limite?: number | null; jaEnviadas: number }) {
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [descricao, setDescricao] = useState('')
  const enviadas = jaEnviadas + itens.filter((i) => i.status === 'ok').length
  const esgotado = !!limite && enviadas >= limite

  async function enviar(files: FileList | null) {
    const lista = Array.from(files || [])
    if (!lista.length) return
    const g = await obterLocalizacao(10000)
    for (const f of lista) {
      const item: Item = { nome: f.name, preview: URL.createObjectURL(f), status: 'enviando' }
      setItens((s) => [item, ...s])
      const fd = new FormData()
      fd.append('arquivo', f); fd.append('sessao', sessao); fd.append('nome', nome)
      if (descricao) fd.append('descricao', descricao)
      if (g.ok) { fd.append('latitude', String(g.coords.latitude)); fd.append('longitude', String(g.coords.longitude)); if (g.coords.precisao) fd.append('precisao', String(g.coords.precisao)) }
      try { await publico.enviarFoto(token, fd); item.status = 'ok' } catch (e: any) { item.status = 'erro'; item.msg = e.message }
      setItens((s) => [...s])
    }
  }

  return (
    <div className="space-y-4">
      <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição das próximas fotos (opcional)" />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { enviar(e.target.files); e.target.value = '' }} />
      <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(e) => { enviar(e.target.files); e.target.value = '' }} />
      <div className="grid grid-cols-2 gap-3">
        <Button className="h-24 flex-col text-base" disabled={esgotado} onClick={() => camera.current?.click()} icon={<Camera className="h-7 w-7" />}>Tirar foto</Button>
        <Button className="h-24 flex-col text-base" variant="secondary" disabled={esgotado} onClick={() => galeria.current?.click()} icon={<ImagePlus className="h-7 w-7" />}>Da galeria</Button>
      </div>
      <p className="text-center text-xs text-slate-500">{enviadas} foto(s) enviada(s){limite ? ` de ${limite}` : ''}{esgotado ? ' — limite atingido' : ''}</p>
      <ul className="grid grid-cols-3 gap-2">
        {itens.map((i, k) => (
          <li key={k} className="relative overflow-hidden rounded-lg">
            <img src={i.preview} alt="" className="aspect-square w-full object-cover" />
            <span className="absolute right-1 top-1 rounded-full bg-white p-0.5">
              {i.status === 'enviando' ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : i.status === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
            </span>
            {i.msg && <span className="absolute inset-x-0 bottom-0 bg-rose-600/90 p-1 text-[10px] text-white">{i.msg}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
