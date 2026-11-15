import { Button, Card, Loading, Toggle } from '@/components/ui'
import { frontModules } from '@/modules'
import { useConfig } from './useConfig'

const CORE = new Set(['admin', 'sistema', 'backup'])

/** Ativa/desativa módulos em tempo de execução (oculta menu e bloqueia a API). */
export function Modulos() {
  const { v, set, save, saving, loading } = useConfig('modulos')
  if (loading || !v) return <Loading />
  const off = new Set<string>(v.desativados || [])
  return (
    <Card title="Módulos" actions={<Button onClick={async () => { await save(); location.reload() }} loading={saving}>Salvar</Button>}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {frontModules.filter((m) => !CORE.has(m.key)).map((m) => {
          const Icon = m.nav[0]?.icon
          return (
            <li key={m.key} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <span className="flex items-center gap-2 text-sm font-medium">{Icon && <Icon className="h-4 w-4 text-primary" />}{m.nav[0]?.label || m.key}</span>
              <Toggle checked={!off.has(m.key)} onChange={(on) => set('desativados', on ? [...off].filter((k) => k !== m.key) : [...off, m.key])} />
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
