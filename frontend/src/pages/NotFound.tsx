import { Link } from 'react-router-dom'
import { Empty } from '@/components/ui'

export default function NotFound() {
  return <Empty title="Página não encontrada" text="Ela pode ter sido movida ou você não tem acesso a este módulo." action={<Link to="/" className="text-sm text-primary">Voltar ao painel</Link>} />
}
