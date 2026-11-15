import { useMemo } from 'react'
import { useAuth } from '@/core/auth'
import { ALWAYS, frontModules } from '@/modules'
import type { NavItem } from '@/modules/types'

export interface NavGroup { group: string; items: NavItem[] }

/** Itens de menu visíveis para o usuário (módulo habilitado + permissão). */
export function useNav() {
  const { can, canAny, modules } = useAuth()
  return useMemo(() => {
    const visible = (i: NavItem) => (!i.perm || can(...i.perm)) && (!i.any || canAny(...i.any))
    const groups: Record<string, NavItem[]> = {}
    const flat: NavItem[] = []
    frontModules.forEach((m) => {
      if (!ALWAYS.has(m.key) && !modules.has(m.key)) return
      m.nav.filter(visible).forEach((i) => {
        const g = m.group || ''
        ;(groups[g] ||= []).push(i)
        flat.push(i)
      })
    })
    const order = ['', 'Operação', 'Gestão', 'Ferramentas', 'Sistema']
    const grouped: NavGroup[] = order.filter((g) => groups[g]).map((g) => ({ group: g, items: groups[g] }))
    return { grouped, flat, mobile: flat.filter((i) => i.mobile).slice(0, 4) }
  }, [can, canAny, modules])
}
