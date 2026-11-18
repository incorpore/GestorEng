import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { useEffect, useRef, useState } from 'react'
import { Braces, Code2 } from 'lucide-react'
import clsx from 'clsx'
import { Textarea, useConfirm, useToast } from '@/components/ui'
import { BarraEditor } from './components/BarraEditor'
import { VariablePicker } from './VariablePicker'

const hasBlocks = (html: string) => /\{%/.test(html)

interface Props { value: string; onChange: (html: string) => void; readOnly?: boolean; entidade?: string | null }

export function RichEditor({ value, onChange, readOnly, entidade }: Props) {
  const toast = useToast()
  const confirm = useConfirm()
  const [mode, setMode] = useState<'visual' | 'html'>(() => (hasBlocks(value) ? 'html' : 'visual'))
  const [picker, setPicker] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const ed = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline, TextStyle, Color,
      TextAlign.configure({ types: ['heading', 'paragraph', 'tableCell', 'tableHeader'] }),
      Table.configure({ resizable: false }), TableRow, TableCell, TableHeader,
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: 'Escreva o documento. Use "Variáveis" para inserir dados como {{ obra.nome }}.' }),
    ],
    content: mode === 'visual' ? value : '',
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => { ed?.setEditable(!readOnly) }, [ed, readOnly])
  // sincroniza alterações externas (IA, emissão, recarga) quando o editor não está em foco
  useEffect(() => {
    if (ed && mode === 'visual' && !ed.isFocused && value !== ed.getHTML()) ed.commands.setContent(value, false)
  }, [ed, mode, value])
  useEffect(() => {
    if (ed && mode === 'visual' && value !== ed.getHTML()) ed.commands.setContent(value, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ed])

  function insert(text: string) {
    if (mode === 'visual' && ed) ed.chain().focus().insertContent(text).run()
    else if (taRef.current) {
      const ta = taRef.current
      const s = ta.selectionStart, e = ta.selectionEnd
      onChange(value.slice(0, s) + text + value.slice(e))
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + text.length })
    }
    setPicker(false)
  }

  function onImage(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    if (f.size > 1.5 * 1024 * 1024) { toast('Imagem muito grande (máx. 1,5 MB)', 'error'); return }
    const r = new FileReader()
    r.onload = () => { ed?.chain().focus().setImage({ src: String(r.result) }).run() }
    r.readAsDataURL(f)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex gap-1">
          <button type="button" className={clsx('rounded px-2 py-1', mode === 'visual' && 'bg-white shadow-sm dark:bg-slate-900')}
            onClick={async () => { if (hasBlocks(value) && !(await confirm('O modelo contém blocos {% %} que podem ser alterados pelo editor visual. Continuar?', { title: 'Editor visual', ok: 'Continuar' }))) return; setMode('visual') }}>Visual</button>
          <button type="button" className={clsx('inline-flex items-center gap-1 rounded px-2 py-1', mode === 'html' && 'bg-white shadow-sm dark:bg-slate-900')} onClick={() => setMode('html')}><Code2 className="h-3.5 w-3.5" />HTML</button>
        </div>
        {mode === 'html' && !readOnly && <button type="button" onClick={() => setPicker(true)} className="inline-flex items-center gap-1 rounded bg-primary-100 px-2 py-1 font-medium text-primary"><Braces className="h-3.5 w-3.5" />Variáveis</button>}
      </div>
      {mode === 'visual' ? (
        <div className="doc-editor max-h-[70vh] overflow-y-auto">
          {ed && !readOnly && <BarraEditor ed={ed} onVar={() => setPicker(true)} onImage={() => fileRef.current?.click()} />}
          <div className="mx-auto max-w-[210mm] bg-white text-slate-900"><EditorContent editor={ed} /></div>
        </div>
      ) : (
        <Textarea ref={taRef} variante="codigo" readOnly={readOnly} spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onImage(e.target.files)} />
      <VariablePicker open={picker} onClose={() => setPicker(false)} onPick={insert} entidade={entidade} />
    </div>
  )
}
