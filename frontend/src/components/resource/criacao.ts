import type { FieldDef } from './types'

/** Formulário usado para cadastrar um item novo direto de uma lista suspensa (pop-up). */
export interface CriacaoDef { endpoint: string; singular: string; perm: string; fields: FieldDef[]; labelKey?: string }

const mapa = new Map<string, CriacaoDef>()

/** Cada módulo registra os cadastros que podem ser criados a partir de listas suspensas de outros formulários. */
export function registrarCriacao(def: CriacaoDef) {
  mapa.set(def.endpoint, def)
}

export const criacaoPara = (endpoint: string) => mapa.get(endpoint)
