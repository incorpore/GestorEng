export interface LinkPublico {
  id: number; url: string; tipo: 'visualizar' | 'fotos'; titulo: string; destinatario?: string | null; instrucoes?: string | null
  exige_localizacao: boolean; max_fotos?: number | null; expira_em: string; ativo: boolean; created_at: string
  acessos: number; fotos_recebidas: number; ultimo_acesso?: string | null
  encerramento?: 'finalizado' | 'desativado' | 'excluido' | null; encerrado_em?: string | null
}
export interface Acesso {
  id: number; at: string; evento: string; ip?: string | null; user_agent?: string | null; latitude?: number | null
  longitude?: number | null; precisao?: number | null; nome?: string | null
}
export const EVENTO: Record<string, string> = {
  abriu: 'Abriu o link', localizacao: 'Compartilhou localização', localizacao_negada: 'Recusou localização',
  visualizou: 'Visualizou o conteúdo', enviou_foto: 'Enviou foto', baixou_pdf: 'Baixou o PDF', finalizou: 'Finalizou o envio',
}

/** Endereço completo do link (no app usa o servidor configurado). */
export function urlCompleta(caminho: string, servidor?: string) {
  return `${servidor || window.location.origin}${caminho}`
}
