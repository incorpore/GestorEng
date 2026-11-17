import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { erroDeVersao, recarregarParaNovaVersao } from '@/core/versao'

/** Erro ao abrir uma tela: se for arquivo de versão antiga (após atualização), recarrega sozinho. */
export default function ErroRota() {
  const erro = useRouteError()
  const versao = erroDeVersao(erro)
  useEffect(() => { if (versao) recarregarParaNovaVersao() }, [versao])
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <RefreshCw className={`h-10 w-10 text-primary ${versao ? 'animate-spin' : ''}`} />
      <p className="text-lg font-semibold">{versao ? 'O Struvia foi atualizado' : 'Não foi possível abrir esta tela'}</p>
      <p className="max-w-md text-sm text-slate-500">{versao ? 'Carregando a versão nova...' : String((erro as any)?.message || erro || 'Erro inesperado')}</p>
      <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Recarregar</button>
    </div>
  )
}
