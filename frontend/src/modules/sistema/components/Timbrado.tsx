import { useRef, useState } from 'react'
import { Eye, Upload } from 'lucide-react'
import { Button, Card, Field, Input, Loading, Toggle } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'
import { PdfPreview } from '../../documentos/components/PdfPreview'
import { useConfig } from './useConfig'

const AMOSTRA = `<h2 style="text-align: center">PRÉ-VISUALIZAÇÃO DO TIMBRADO</h2><p>{{ cidade_emissao }}, {{ hoje|data_extenso }}.</p>
<p>Este texto mostra a área útil da página respeitando as margens configuradas. ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(30)}</p>
<p>${'Texto de continuação para verificar a segunda página e o timbrado de continuação. '.repeat(60)}</p>`

/** Papel timbrado (imagem A4 ou PDF), página de continuação, margens e fonte. */
export function Timbrado() {
  const { v, set, setV, save, saving, loading } = useConfig('timbrado')
  const toast = useToast()
  const r1 = useRef<HTMLInputElement>(null)
  const r2 = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(false)
  if (loading || !v) return <Loading />
  async function upload(f: File | undefined, continuacao: boolean) {
    if (!f) return
    const fd = new FormData(); fd.append('arquivo', f)
    try { setV(await api.post(`/configuracoes/timbrado/arquivo?continuacao=${continuacao}`, fd)); toast('Timbrado enviado') } catch (e) { toast(errMsg(e), 'error') }
  }
  const num = (k: string, l: string) => <Field label={l}><Input type="number" min={0} max={120} step="0.5" value={v[k]} onChange={(e) => set(k, Number(e.target.value))} /></Field>
  return (
    <div className="space-y-4">
      <Card title="Papel timbrado" actions={<>
        <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={async () => { await save(); setPreview(true) }}>Testar</Button>
        <Button onClick={() => save()} loading={saving}>Salvar</Button></>}>
        <div className="space-y-4">
          <Toggle checked={!!v.ativo} onChange={(x) => set('ativo', x)} label="Aplicar timbrado nos documentos" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700">
              <p className="font-medium">Primeira página {v.arquivo_id ? '✓' : ''}</p>
              <p className="mb-2 text-xs text-slate-500">PDF A4 (1 ou 2 páginas — a 2ª vira continuação) ou imagem PNG/JPG A4 (2480×3508 px a 300 dpi).</p>
              <input ref={r1} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(e) => upload(e.target.files?.[0], false)} />
              <Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => r1.current?.click()}>Enviar</Button>
            </div>
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700">
              <p className="font-medium">Páginas seguintes (opcional) {v.arquivo_continuacao_id ? '✓' : ''}</p>
              <p className="mb-2 text-xs text-slate-500">Se vazio, usa o mesmo da primeira página.</p>
              <input ref={r2} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(e) => upload(e.target.files?.[0], true)} />
              <Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => r2.current?.click()}>Enviar</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {num('margem_superior', 'Margem superior (mm)')}{num('margem_inferior', 'Margem inferior (mm)')}
            {num('margem_esquerda', 'Margem esquerda (mm)')}{num('margem_direita', 'Margem direita (mm)')}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Fonte" className="col-span-2"><Input value={v.fonte} onChange={(e) => set('fonte', e.target.value)} /></Field>
            <Field label="Tamanho (pt)"><Input type="number" step="0.5" value={v.tamanho_fonte} onChange={(e) => set('tamanho_fonte', Number(e.target.value))} /></Field>
            <Field label="Entrelinha"><Input type="number" step="0.05" value={v.entrelinha} onChange={(e) => set('entrelinha', Number(e.target.value))} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle checked={!!v.numerar_paginas} onChange={(x) => set('numerar_paginas', x)} label="Numerar páginas" />
            <Field label="Texto da numeração" hint="Use {pagina} e {total}"><Input value={v.texto_numeracao} onChange={(e) => set('texto_numeracao', e.target.value)} /></Field>
          </div>
        </div>
      </Card>
      <PdfPreview open={preview} onClose={() => setPreview(false)} body={{ conteudo: AMOSTRA, usar_timbrado: true }} />
    </div>
  )
}
