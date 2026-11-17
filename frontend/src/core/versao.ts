/** Depois de uma atualização do Struvia, uma aba aberta antes dela ainda aponta para arquivos da versão anterior
 *  (os nomes mudam a cada versão). Quando um desses arquivos falha ao carregar, recarrega a página uma vez para
 *  buscar a versão nova — no máximo uma vez a cada 30 s, para nunca entrar em ciclo. */
const CHAVE = 'struvia-recarregou-em'

export const erroDeVersao = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically|ChunkLoadError|Loading chunk/i
    .test(String((e as any)?.message || e))

export function recarregarParaNovaVersao(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) || 0)
    if (Date.now() - ultima < 30_000) return false
    sessionStorage.setItem(CHAVE, String(Date.now()))
  } catch { /* sem sessionStorage: recarrega mesmo assim */ }
  window.location.reload()
  return true
}

export function protegerContraVersaoAntiga() {
  window.addEventListener('vite:preloadError', (ev) => {
    if (recarregarParaNovaVersao()) ev.preventDefault()
  })
  window.addEventListener('unhandledrejection', (ev) => {
    if (erroDeVersao(ev.reason)) recarregarParaNovaVersao()
  })
}
