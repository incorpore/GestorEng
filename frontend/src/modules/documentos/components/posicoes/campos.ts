export interface CampoPos { indice: number; pagina: number; x: number; y: number; largura: number; altura: number }
const CORES = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4b5563']
/** Cor fixa de cada assinante (mesma na lista e nos retângulos). */
export const corAssinante = (i: number) => CORES[i % CORES.length]
export const LARGURA = 28
export const ALTURA = 6
