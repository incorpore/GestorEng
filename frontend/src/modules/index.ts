/**
 * Registro de módulos do frontend.
 * Para adicionar um módulo: crie `src/modules/<nome>/index.tsx` exportando um FrontModule
 * (key igual à do backend) e inclua-o na lista abaixo.
 */
import admin from './admin'
import cadastros from './cadastros'
import conta from './conta'
import diario from './diario'
import documentos from './documentos'
import financeiro from './financeiro'
import frota from './frota'
import funcionarios from './funcionarios'
import ia from './ia'
import inventario from './inventario'
import licitacoes from './licitacoes'
import obras from './obras'
import orcamentos from './orcamentos'
import painel from './painel'
import sistema from './sistema'
import type { FrontModule } from './types'

export const frontModules: FrontModule[] = [painel, obras, diario, licitacoes, orcamentos, financeiro, documentos, frota, funcionarios, inventario, cadastros, ia, admin, sistema, conta]

/** módulos que sempre aparecem (não dependem de habilitação no backend) */
export const ALWAYS = new Set(['painel', 'conta', 'admin', 'sistema'])
