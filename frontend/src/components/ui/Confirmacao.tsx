import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Button } from './Botoes'
import { Modal } from './Sobreposicao'

/** Confirmação padrão: const confirm = useConfirm(); if (await confirm('Excluir?', { danger: true, ok: 'Excluir' })) ...
 *  Sempre aparece acima de qualquer pop-up ou visualizador de fotos. */
const ConfirmCtx = createContext<(msg: string, opts?: { title?: string; danger?: boolean; ok?: string }) => Promise<boolean>>(async () => false)
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ msg: string; title?: string; danger?: boolean; ok?: string; resolve: (v: boolean) => void } | null>(null)
  const confirm = useCallback((msg: string, opts: { title?: string; danger?: boolean; ok?: string } = {}) =>
    new Promise<boolean>((resolve) => setState({ msg, ...opts, resolve })), [])
  const close = (v: boolean) => { state?.resolve(v); setState(null) }
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title || 'Confirmar'} size="sm" camada="confirm"
        footer={<><Button variant="secondary" onClick={() => close(false)}>Cancelar</Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state?.ok || 'Confirmar'}</Button></>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">{state?.msg}</p>
      </Modal>
    </ConfirmCtx.Provider>
  )
}
export const useConfirm = () => useContext(ConfirmCtx)
