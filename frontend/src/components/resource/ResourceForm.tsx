import { useEffect, useState } from 'react'
import { Button, Field, Modal } from '@/components/ui'
import { api } from '@/core/api'
import { errMsg, useToast } from '@/core/toast'
import { FieldInput } from './FieldInput'
import type { FieldDef } from './types'

export function initialValues(fields: FieldDef[], row?: Record<string, any> | null) {
  const v: Record<string, any> = {}
  fields.forEach((f) => {
    v[f.name] = row ? row[f.name] ?? null : typeof f.default === 'function' ? (f.default as () => unknown)() : f.default ?? (f.type === 'boolean' ? false : null)
  })
  return v
}

const spanCls = { 1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4' }

export function FormGrid({ fields, values, set }: { fields: FieldDef[]; values: Record<string, any>; set: (k: string, v: any) => void }) {
  const sections: { name?: string; items: FieldDef[] }[] = []
  fields.forEach((f) => {
    const last = sections[sections.length - 1]
    if (!last || (f.section && f.section !== last.name)) sections.push({ name: f.section, items: [f] })
    else last.items.push(f)
  })
  return (
    <div className="space-y-5">
      {sections.map((s, i) => (
        <div key={i}>
          {s.name && <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{s.name}</h4>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            {s.items.filter((f) => !f.hidden?.(values)).map((f) => (
              <Field key={f.name} label={f.label} required={f.required} hint={f.hint}
                className={spanCls[f.span || (f.type === 'textarea' ? 4 : 2)]}>
                <FieldInput f={f} value={values[f.name]} onChange={(v) => set(f.name, v)} values={values} set={set} />
              </Field>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  endpoint: string
  fields: FieldDef[]
  row?: any | null
  title: string
  onSaved: (row: any) => void
  size?: 'md' | 'lg' | 'xl'
  extra?: (values: Record<string, any>, set: (k: string, v: any) => void) => React.ReactNode
  transformOut?: (values: Record<string, any>) => Record<string, any>
  defaults?: Record<string, any>
}

export function ResourceForm({ open, onClose, endpoint, fields, row, title, onSaved, size = 'lg', extra, transformOut, defaults }: Props) {
  const toast = useToast()
  const [values, setValues] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setValues({ ...initialValues(fields, row), ...(row ? { itens: row.itens } : {}), ...(!row ? defaults : {}) })
  }, [open, row, fields, defaults])

  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      let body: Record<string, any> = {}
      const names = new Set(fields.filter((f) => !f.readOnly).map((f) => f.name))
      Object.entries(values).forEach(([k, v]) => { if (names.has(k) || k === 'itens') body[k] = typeof v === 'string' && v.trim() === '' ? null : v })
      if (body.itens === undefined) delete body.itens
      if (transformOut) body = transformOut(body)
      const saved = row?.id ? await api.patch(`${endpoint}/${row.id}`, body) : await api.post(endpoint, body)
      toast(row?.id ? 'Alterações salvas' : 'Registro criado')
      onSaved(saved)
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size={size}
      footer={<>
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="resource-form" loading={saving}>Salvar</Button>
      </>}>
      <form id="resource-form" onSubmit={submit} className="space-y-5">
        <FormGrid fields={fields} values={values} set={set} />
        {extra?.(values, set)}
      </form>
    </Modal>
  )
}
