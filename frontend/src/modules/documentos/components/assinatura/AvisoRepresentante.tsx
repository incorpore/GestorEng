import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth'

/** Exibido quando a empresa ainda não tem representante legal com e-mail (assinante obrigatório). */
export function AvisoRepresentante({ onIr }: { onIr: () => void }) {
  const { can } = useAuth()
  return (
    <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
      O representante legal é sempre um dos assinantes. Cadastre o <b>nome</b> e o <b>e-mail do representante legal</b> em
      {' '}{can('configuracoes.editar') ? <Link to="/configuracoes" className="font-medium underline" onClick={onIr}>Configurações › Empresa</Link> : 'Configurações › Empresa (peça a um administrador)'}.
    </div>
  )
}
