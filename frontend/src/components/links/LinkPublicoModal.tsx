import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Ban, Copy, MessageCircle, Share2, Trash2 } from 'lucide-react'
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
  const gerando = useRef(false)
  const [erroGerar, setErroGerar] = useState<string | null>(null)

  // "Pedir fotos": gera o link na hora, sem formulário
  useEffect(() => {
    if (!open || tipoInicial !== 'fotos' || gerando.current) return
    gerando.current = true
    setErroGerar(null)
    api.post<LinkPublico>('/links-publicos', { tipo: 'fotos', entidade, entidade_id: entidadeId })
      .then((l) => { setCriado(l); qc.invalidateQueries({ queryKey: key }) })
      .catch((e) => setErroGerar(errMsg(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipoInicial, entidade, entidadeId])
  const lista = useQuery({ queryKey: key, queryFn: () => api.get<LinkPublico[]>('/links-publicos', { entidade, entidade_id: entidadeId }), enabled: open, refetchInterval: open ? 8000 : false })
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
    try { await api.post(`/links-publicos/${l.id}/desativar`); qc.invalidateQueries({ queryKey: key }); toast('Link encerrado') } catch (e) { toast(errMsg(e), 'error') }
  }
  async function excluir(l: LinkPublico) {
    if (!confirm('Excluir este link? Ele deixa de funcionar imediatamente. As fotos já recebidas e o registro de acessos são mantidos.')) return
    try {
      await api.del(`/links-publicos/${l.id}`)
      if (criado?.id === l.id) setCriado(null)
      qc.invalidateQueries({ queryKey: key }); toast('Link excluído')
    } catch (e) { toast(errMsg(e), 'error') }
  }
  const situacao = (l: LinkPublico) => l.ativo ? <Badge tone="green">ativo</Badge>
    : l.encerramento === 'finalizado' ? <Badge tone="blue">finalizado por quem fotografou</Badge>
    : <Badge tone="gray">{l.encerramento === 'desativado' ? 'encerrado' : 'expirado'}</Badge>
  const acoes = (l: LinkPublico) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => copiar(l)}>Copiar</Button>
      <Button size="sm" variant="secondary" icon={podeCompartilhar ? <Share2 className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        onClick={() => compartilhar(l)}>{podeCompartilhar ? 'Compartilhar' : 'WhatsApp'}</Button>
    </div>
  )

  return (
    <Modal open={open} onClose={() => { setCriado(null); setDetalhe(null); gerando.current = false; onClose() }} title="Link público" size="lg">
      <Tabs value={aba} onChange={(a) => { setAba(a); setCriado(null); setDetalhe(null); lista.refetch() }} tabs={[{ key: 'novo', label: 'Novo link' }, { key: 'links', label: `Links e acessos${lista.data?.length ? ` (${lista.data.length})` : ''}` }]} />
      <div className="pt-4">
        {aba === 'novo' && !criado && tipoInicial === 'fotos' && (erroGerar ? <p className="text-sm text-rose-600">{erroGerar}</p> : <Loading />)}
        {aba === 'novo' && !criado && tipoInicial !== 'fotos' && <NovoLinkForm entidade={entidade} entidadeId={entidadeId} tipoInicial={tipoInicial}
          onCriado={(l) => { setCriado(l); qc.invalidateQueries({ queryKey: key }) }} />}
        {aba === 'novo' && criado && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {criado.tipo === 'fotos' ? <>Envie este link para quem vai fotografar. A pessoa tira quantas fotos quiser pela câmera do celular; cada foto chega aqui na hora. O link fecha quando ela tocar em <b>Finalizar</b>, quando você excluí-lo ou em {dataHora(criado.expira_em)}.</>
                : <>Link gerado — válido até {dataHora(criado.expira_em)}:</>}
            </p>
            <code className="block break-all rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">{url(criado)}</code>
            <div className="flex flex-wrap items-center justify-between gap-2">{acoes(criado)}
              <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => excluir(criado)}>Excluir link</Button></div>
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
                      {' '}{situacao(l)}</p>
                    <p className="text-xs text-slate-500">{l.acessos} acesso(s){l.tipo === 'fotos' && ` · ${l.fotos_recebidas} foto(s)`} · expira {dataHora(l.expira_em)}</p>
                  </div>
                  <div className="flex gap-2">
                    {l.ativo && acoes(l)}
                    {l.ativo && <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => desativar(l)}>Encerrar</Button>}
                    <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => excluir(l)}>Excluir</Button>
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
