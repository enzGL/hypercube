// Ponto único de acesso ao sistema. A interface só importa daqui.
import { criarNativoSimulado } from './simulado';
import { criarNativoTauri } from './tauri';
import type { Nativo } from './tipos';

const emTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const nativo: Nativo = emTauri ? criarNativoTauri() : criarNativoSimulado();

export * from './tipos';
export { NOME_AGENTE } from './simulado';
