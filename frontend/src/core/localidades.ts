import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export interface Estado { id: number; sigla: string; nome: string }
export interface Municipio { id: number; nome: string }

/** Estados e municípios pela base pública do IBGE (com cache no servidor). */
export const useEstados = () =>
  useQuery({ queryKey: ['ibge', 'estados'], queryFn: () => api.get<Estado[]>('/localidades/estados'), staleTime: Infinity })

export const useMunicipios = (uf?: string | null) =>
  useQuery({ queryKey: ['ibge', 'municipios', uf], queryFn: () => api.get<Municipio[]>('/localidades/municipios', { uf }),
    enabled: !!uf && uf.length === 2, staleTime: Infinity })
