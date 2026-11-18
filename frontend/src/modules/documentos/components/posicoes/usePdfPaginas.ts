import { useEffect, useRef, useState } from 'react'
import { api } from '@/core/api'

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any> }

/** Abre o PDF do documento (pdf.js, carregado sob demanda) e desenha uma página por vez como imagem. */
export function usePdfPaginas(docId: number) {
  const pdf = useRef<PdfDoc | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [imagem, setImagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        // '?v=2': o arquivo já foi servido com tipo errado e ficou em cache por 1 ano; endereço novo força buscar de novo
        pdfjs.GlobalWorkerOptions.workerSrc = `${worker.default}?v=2`
        const dados = await (await api.blob(`/documentos-acoes/${docId}/pdf`)).arrayBuffer()
        const doc = await pdfjs.getDocument({ data: dados, isEvalSupported: false }).promise
        if (!vivo) return
        pdf.current = doc
        setTotal(doc.numPages)
        setPagina(doc.numPages) // assinaturas costumam ficar na última página
      } catch (e: any) { if (vivo) setErro(e?.message || 'Não foi possível abrir o PDF') }
    })()
    return () => { vivo = false }
  }, [docId])

  useEffect(() => {
    if (!pdf.current || !pagina) return
    let vivo = true
    setImagem(null)
    ;(async () => {
      const page = await pdf.current!.getPage(pagina)
      const vp = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width = vp.width; canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
      if (vivo) setImagem(canvas.toDataURL('image/png'))
    })().catch((e) => vivo && setErro(e?.message || 'Falha ao exibir a página'))
    return () => { vivo = false }
  }, [pagina, total])

  return { total, pagina, setPagina, imagem, erro }
}
