import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Braces, Columns3, Heading2, Heading3, ImagePlus, Italic, List, ListOrdered, Minus, Redo2, Rows3, Table2, Trash, Underline as U, Undo2 } from 'lucide-react'
import clsx from 'clsx'

function TB({ on, active, label, children, disabled }: { on: () => void; active?: boolean; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={clsx('inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800',
        active && 'bg-primary-100 text-primary')}>{children}</button>
  )
}

/** Barra de formatação do editor visual de documentos. */
export function BarraEditor({ ed, onVar, onImage }: { ed: Editor; onVar: () => void; onImage: () => void }) {
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
