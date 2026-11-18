export interface Assinante { id: string; nome: string; email: string; papel: string; representante?: boolean }
export interface Recente { nome: string; email: string }

let seq = 0
export const novoId = () => `a${++seq}`
export const PAPEIS = [['SIGNER', 'Assinante'], ['APPROVER', 'Aprovador'], ['VIEWER', 'Visualizador'], ['CC', 'Cópia']]
export const mesmoEmail = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
