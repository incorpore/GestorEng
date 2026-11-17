import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Ban, Copy, MessageCircle, Share2 } from 'lucide-react'
import { Badge, Button, Empty, Loading, Modal, Tabs } from '@/components/ui'
import { api } from '@/core/api'
import { dataHora } from '@/core/format'
import { getServerUrl, isNative } from '@/core/platform'
import { errMsg, useToast } from '@/core/toast'
import { AcessosLink } from './AcessosLink'
import { NovoLinkForm } from './NovoLinkForm'
import { type LinkPublico, urlCompleta } from './tipos'

const podeCompartilhar = typeof navigator !== 'undefined' && 'share' in navigator

export function LinkPublicoModal({ entidade, entidadeId, tipoInicial = 'fotos', open, onClose }: {
  entidade: 'diario' | 'obra'; entidadeId: number; tipoInicial?: 'visualizar' | 'fotos'; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [aba, setAba] = useState<'novo' | 'links'>('novo')
  const [criado, setCriado] = useState<LinkPublico | null>(null)
  const [detalhe, setDetalhe] = useState<number | null>(null)
  const key = ['links', entidade, entidadeId]
  const lista = useQuery({ queryKey: key, queryFn: () => api.get<LinkPublico[]>('/links-publicos', { entidade, entidade_id: entidadeId }), enabled: open })
  const url = (l: LinkPublico) => urlCompleta(l.url, isNative ? getServerUrl() : undefined)

  async function copiar(l: LinkPublico) {
    try { await navigator.clipboard.writeText(url(l)); toast('Link copiado') } catch { toast(url(l), 'info') }
  }
  function compartilhar(l: LinkPublico) {
    const texto = `${l.titulo}${l.destinatario ? ` — ${l.destinatario}` : ''}: ${url(l)}`
    if (podeCompartilhar) navigator.share({ title: l.titulo, text: texto, url: url(l) }).catch(() => null)
    else window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }
  async function desativar(l: LinkPublico) {
    try { await api.post(`/links-publicos/${l.id}/desativar`); qc.invalidateQueries({ queryKey: key }); toast('Link desativado') } catch (e) { toast(errMsg(e), 'error') }
  }
  const acoes = (l: LinkPublico) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => copiar(l)}>Copiar</Button>
      <Button size="sm" variant="secondary" icon={podeCompartilhar ? <Share2 className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        onClick={() => compartilhar(l)}>{podeCompartilhar ? 'Compartilhar' : 'WhatsApp'}</Button>
    </div>
  )

  return (
    <Modal open={open} onClose={() => { setCriado(null); setDetalhe(null); onClose() }} title="Link público" size="lg">
      <Tabs value={aba} onChange={(a) => { setAba(a); setCriado(null); setDetalhe(null) }} tabs={[{ key: 'novo', label: 'Novo link' }, { key: 'links', label: `Links e acessos${lista.data?.length ? ` (${lista.data.length})` : ''}` }]} />
      <div className="pt-4">
        {aba === 'novo' && !criado && <NovoLinkForm entidade={entidade} entidadeId={entidadeId} tipoInicial={tipoInicial}
          onCriado={(l) => { setCriado(l); qc.invalidateQueries({ queryKey: key }) }} />}
        {aba === 'novo' && criado && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">Link gerado — válido até {dataHora(criado.expira_em)}:</p>
            <code className="block break-all rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">{url(criado)}</code>
            {acoes(criado)}
            {!window.isSecureContext && !isNative && <p className="text-xs text-amber-600">Atenção: este endereço não usa HTTPS; o navegador de quem abrir não fornecerá a localização. O IP continuará sendo registrado.</p>}
          </div>
        )}
        {aba === 'links' && (lista.isLoading ? <Loading /> : !lista.data?.length ? <Empty title="Nenhum link criado" /> : (
          <ul className="space-y-2">
            {lista.data.map((l) => (
              <li key={l.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{l.tipo === 'fotos' ? 'Pedido de fotos' : 'Visualização'}{l.destinatario && ` — ${l.destinatario}`}
                      {' '}<Badge tone={l.ativo ? 'green' : 'gray'}>{l.ativo ? 'ativo' : 'inativo'}</Badge></p>
                    <p className="text-xs text-slate-500">{l.acessos} acesso(s){l.tipo === 'fotos' && ` · ${l.fotos_recebidas} foto(s)`} · expira {dataHora(l.expira_em)}</p>
                  </div>
                  <div className="flex gap-2">
                    {l.ativo && acoes(l)}
                    {l.ativo && <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => desativar(l)}>Desativar</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setDetalhe(detalhe === l.id ? null : l.id)}>{detalhe === l.id ? 'Ocultar' : 'Acessos'}</Button>
                  </div>
                </div>
                {detalhe === l.id && <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800"><AcessosLink linkId={l.id} /></div>}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </Modal>
  )
}
