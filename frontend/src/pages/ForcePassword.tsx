import { TrocarSenha } from '@/modules/conta/components/TrocarSenha'
import { Brand } from '@/components/layout/Brand'
import { useAuth } from '@/core/auth'

export default function ForcePassword() {
  const { logout } = useAuth()
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-4 p-4">
      <Brand />
      <p className="text-sm text-slate-600 dark:text-slate-300">Por segurança, defina uma nova senha antes de continuar.</p>
      <TrocarSenha />
      <button className="text-sm text-slate-500" onClick={() => logout()}>Sair</button>
    </div>
  )
}
