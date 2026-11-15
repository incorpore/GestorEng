import { useEditor, EditorContent, type Editor } from '@tiptap/react'
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
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Braces, Code2, Heading2, Heading3, ImagePlus, Italic, List, ListOrdered,
  Minus, Redo2, Table2, Underline as U, Undo2, Rows3, Columns3, Trash } from 'lucide-react'
import clsx from 'clsx'
import { VariablePicker } from './VariablePicker'

const hasBlocks = (html: string) => /\{%/.test(html)

function TB({ on, active, label, children, disabled }: { on: () => void; active?: boolean; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={clsx('inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800',
        active && 'bg-primary-100 text-primary')}>{children}</button>
  )
}

function Toolbar({ ed, onVar, onImage }: { ed: Editor; onVar: () => void; onImage: () => void }) {
  const inTable = ed.isActive('table')
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-white/95 p-1 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <TB label="Desfazer" on={() => ed.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></TB>
      <TB label="Refazer" on={() => ed.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></TB>
      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <TB label="Negrito" active={ed.isActive('bold')} on={() => ed.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></TB>
      <TB label="Itálico" active={ed.isActive('italic')} on={() => ed.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></TB>
      <TB label="Sublinhado" active={ed.isActive('underline')} on={() => ed.chain().focus().toggleUnderline().run()}><U className="h-4 w-4" /></TB>
      <TB label="Título" active={ed.isActive('heading', { level: 2 })} on={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></TB>
      <TB label="Subtítulo" active={ed.isActive('heading', { level: 3 })} on={() => ed.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></TB>
      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      {(['left', 'center', 'right', 'justify'] as const).map((a) => {
        const I = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }[a]
        return <TB key={a} label={`Alinhar ${a}`} active={ed.isActive({ textAlign: a })} on={() => ed.chain().focus().setTextAlign(a).run()}><I className="h-4 w-4" /></TB>
      })}
      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <TB label="Lista" active={ed.isActive('bulletList')} on={() => ed.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></TB>
      <TB label="Lista numerada" active={ed.isActive('orderedList')} on={() => ed.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></TB>
      <TB label="Linha horizontal" on={() => ed.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></TB>
      <TB label="Inserir tabela" on={() => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></TB>
      {inTable && <>
        <TB label="Adicionar linha" on={() => ed.chain().focus().addRowAfter().run()}><Rows3 className="h-4 w-4" /></TB>
        <TB label="Adicionar coluna" on={() => ed.chain().focus().addColumnAfter().run()}><Columns3 className="h-4 w-4" /></TB>
        <TB label="Excluir tabela" on={() => ed.chain().focus().deleteTable().run()}><Trash className="h-4 w-4" /></TB>
      </>}
      <TB label="Imagem" on={onImage}><ImagePlus className="h-4 w-4" /></TB>
      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <button type="button" onClick={onVar} onMouseDown={(e) => e.preventDefault()}
        className="inline-flex h-8 items-center gap-1 rounded-md bg-primary-100 px-2 text-xs font-medium text-primary hover:bg-primary/20"><Braces className="h-4 w-4" /> Variáveis</button>
    </div>
  )
}

interface Props { value: string; onChange: (html: string) => void; readOnly?: boolean; entidade?: string | null }

export function RichEditor({ value, onChange, readOnly, entidade }: Props) {
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
    if (f.size > 1.5 * 1024 * 1024) { alert('Imagem muito grande (máx. 1,5 MB)'); return }
    const r = new FileReader()
    r.onload = () => { ed?.chain().focus().setImage({ src: String(r.result) }).run() }
    r.readAsDataURL(f)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex gap-1">
          <button type="button" className={clsx('rounded px-2 py-1', mode === 'visual' && 'bg-white shadow-sm dark:bg-slate-900')}
            onClick={() => { if (hasBlocks(value) && !confirm('O modelo contém blocos {% %} que podem ser alterados pelo editor visual. Continuar?')) return; setMode('visual') }}>Visual</button>
          <button type="button" className={clsx('inline-flex items-center gap-1 rounded px-2 py-1', mode === 'html' && 'bg-white shadow-sm dark:bg-slate-900')} onClick={() => setMode('html')}><Code2 className="h-3.5 w-3.5" />HTML</button>
        </div>
        {mode === 'html' && !readOnly && <button type="button" onClick={() => setPicker(true)} className="inline-flex items-center gap-1 rounded bg-primary-100 px-2 py-1 font-medium text-primary"><Braces className="h-3.5 w-3.5" />Variáveis</button>}
      </div>
      {mode === 'visual' ? (
        <div className="doc-editor max-h-[70vh] overflow-y-auto">
          {ed && !readOnly && <Toolbar ed={ed} onVar={() => setPicker(true)} onImage={() => fileRef.current?.click()} />}
          <div className="mx-auto max-w-[210mm] bg-white text-slate-900"><EditorContent editor={ed} /></div>
        </div>
      ) : (
        <textarea ref={taRef} readOnly={readOnly} spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)}
          className="block min-h-[480px] w-full resize-y bg-slate-950 p-4 font-mono text-xs leading-relaxed text-emerald-200 outline-none" />
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onImage(e.target.files)} />
      <VariablePicker open={picker} onClose={() => setPicker(false)} onPick={insert} entidade={entidade} />
    </div>
  )
}
