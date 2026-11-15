import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button, Card, Loading } from '@/components/ui'
import { FormGrid } from '@/components/resource/ResourceForm'
import type { FieldDef } from '@/components/resource/types'
import { api } from '@/core/api'
import { applyBrandColor } from '@/core/format'
import { errMsg, useToast } from '@/core/toast'
import { absUrl } from '@/core/platform'
import { useConfig } from './useConfig'

const F: FieldDef[] = [
  { name: 'razao_social', label: 'Razão social', span: 2 }, { name: 'nome_fantasia', label: 'Nome fantasia', span: 2 },
  { name: 'cnpj', label: 'CNPJ', span: 1 }, { name: 'inscricao_estadual', label: 'Inscrição estadual', span: 1 }, { name: 'inscricao_municipal', label: 'Inscrição municipal', span: 2 },
  { name: 'endereco', label: 'Endereço', span: 2 }, { name: 'bairro', label: 'Bairro', span: 2 },
  { name: 'cidade', label: 'Cidade', span: 2 }, { name: 'uf', label: 'UF', type: 'uf', span: 1 }, { name: 'cep', label: 'CEP', span: 1 },
  { name: 'telefone', label: 'Telefone', span: 1 }, { name: 'email', label: 'E-mail', span: 1 }, { name: 'site', label: 'Site', span: 2 },
  { name: 'responsavel', label: 'Representante legal', span: 2, section: 'Responsáveis' }, { name: 'cargo_responsavel', label: 'Cargo', span: 1 },
  { name: 'crea', label: 'CREA/CAU da empresa', span: 1 },
  { name: 'cor_primaria', label: 'Cor da marca', type: 'color', span: 1, section: 'Identidade visual' },
]

export function Empresa() {
  const { v, set, save, saving, loading, reload } = useConfig('empresa')
  const toast = useToast()
  const logo = useRef<HTMLInputElement>(null)
  if (loading || !v) return <Loading />
  async function upload(f?: File) {
    if (!f) return
    const fd = new FormData(); fd.append('arquivo', f)
    try { await api.post('/configuracoes/logo', fd); toast('Logo atualizada'); reload() } catch (e) { toast(errMsg(e), 'error') }
  }
  return (
    <Card title="Dados da empresa" actions={<Button onClick={async () => { const r = await save(); if (r) applyBrandColor(r.cor_primaria) }} loading={saving}>Salvar</Button>}>
      <FormGrid fields={F} values={v} set={set} />
      <div className="mt-4 flex items-center gap-3">
        {v.logo_arquivo_id && <img src={absUrl(`/api/publico/logo?v=${v.logo_arquivo_id}`)} alt="Logo" className="h-12 rounded border border-slate-200 bg-white p-1" />}
        <input ref={logo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => logo.current?.click()}>Enviar logo</Button>
        <span className="text-xs text-slate-400">Disponível nos modelos como {'{{ empresa.logo }}'} (use em &lt;img src&gt;).</span>
      </div>
    </Card>
  )
}
