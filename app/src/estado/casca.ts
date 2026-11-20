// Estado da casca: lateral, painel direito, abas de projeto, histórico, tarefas, notas e Pomodoro.
// Fica separado da loja principal. O que vale guardar vai para o localStorage (sempre com try/catch).
import { useSyncExternalStore } from 'react';
import { avisar, COR_PAPEL, irPara, lerEstado, selecionarSessao, type Estado, type Sessao, type Tela } from './loja';
import { nativo } from '../nativo';

export type Rota = Tela | 'inicio';
export type AbaPainel = 'notas' | 'tarefas' | 'plugins' | 'git';
export type ModoLateral = 'sessoes' | 'arquivos' | 'git';
export type FiltroTarefas = 'tudo' | 'ativas' | 'concluidas';

export interface Tarefa {
  id: string;
  texto: string;
  feita: boolean;
  criadaEm: number;
}

export interface Pomodoro {
  rodando: boolean;
  fimEm: number | null; // quando rodando
  restanteMs: number; // quando parado/pausado
  iniciado: boolean;
}

export const POMODORO_MS = 25 * 60 * 1000;

export interface EstadoCasca {
  lateralRecolhida: boolean;
  painelAberto: boolean;
  aba: AbaPainel;
  modoLateral: ModoLateral;
  abasFechadas: string[];
  tarefas: Tarefa[];
  filtro: FiltroTarefas;
  focoTarefaId: string | null;
  notas: Record<string, string>;
  pomodoro: Pomodoro;
  pedidoNovaTarefa: number;
}

const CHAVE = 'hypercube.casca';

function ler(): Partial<EstadoCasca> {
  try {
    const t = localStorage.getItem(CHAVE);
    return t ? (JSON.parse(t) as Partial<EstadoCasca>) : {};
  } catch {
    return {};
  }
}

const salvo = ler();

let estado: EstadoCasca = {
  lateralRecolhida: !!salvo.lateralRecolhida,
  painelAberto: salvo.painelAberto ?? true,
  aba: salvo.aba ?? 'tarefas',
  modoLateral: 'sessoes',
  abasFechadas: Array.isArray(salvo.abasFechadas) ? salvo.abasFechadas : [],
  tarefas: Array.isArray(salvo.tarefas) ? salvo.tarefas : [],
  filtro: salvo.filtro ?? 'tudo',
  focoTarefaId: salvo.focoTarefaId ?? null,
  notas: salvo.notas && typeof salvo.notas === 'object' ? salvo.notas : {},
  pomodoro: { rodando: false, fimEm: null, restanteMs: POMODORO_MS, iniciado: false },
  pedidoNovaTarefa: 0,
};

const ouvintes = new Set<() => void>();

function gravar() {
  try {
    const { lateralRecolhida, painelAberto, aba, abasFechadas, tarefas, filtro, focoTarefaId, notas } = estado;
    localStorage.setItem(CHAVE, JSON.stringify({ lateralRecolhida, painelAberto, aba, abasFechadas, tarefas, filtro, focoTarefaId, notas }));
  } catch {
    /* sem armazenamento: segue só na memória */
  }
}

function mudar(f: (e: EstadoCasca) => Partial<EstadoCasca>) {
  estado = { ...estado, ...f(estado) };
  ouvintes.forEach((o) => o());
  gravar();
}

export function useCasca(): EstadoCasca {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
  );
}

// ---------- rotas e histórico ----------

export function irParaRota(r: Rota) {
  irPara(r as Tela);
}

export const rotaAtual = (): Rota => lerEstado().tela as Rota;

interface Passo {
  rota: Rota;
  sessaoId: string | null;
}
const historico: Passo[] = [];
let posicao = -1;
let navegando = false;

/** A barra de cima chama a cada mudança de tela ou sessão. */
export function registrarPasso(rota: Rota, sessaoId: string | null) {
  if (navegando) return;
  const atual = historico[posicao];
  if (atual && atual.rota === rota && atual.sessaoId === sessaoId) return;
  historico.splice(posicao + 1);
  historico.push({ rota, sessaoId });
  if (historico.length > 60) historico.shift();
  posicao = historico.length - 1;
}

export const podeVoltar = () => posicao > 0;
export const podeAvancar = () => posicao < historico.length - 1;

function irParaPasso(p: Passo) {
  navegando = true;
  if (p.sessaoId && lerEstado().sessoes.some((s) => s.id === p.sessaoId)) selecionarSessao(p.sessaoId);
  irParaRota(p.rota);
  navegando = false;
}

export function voltar() {
  if (!podeVoltar()) return;
  posicao -= 1;
  irParaPasso(historico[posicao]);
}

export function avancar() {
  if (!podeAvancar()) return;
  posicao += 1;
  irParaPasso(historico[posicao]);
}

// ---------- lateral e painel ----------

export const alternarLateral = () => mudar((e) => ({ lateralRecolhida: !e.lateralRecolhida }));
export const definirModoLateral = (modoLateral: ModoLateral) => mudar(() => ({ modoLateral, lateralRecolhida: false }));
export const alternarPainel = () => mudar((e) => ({ painelAberto: !e.painelAberto }));

export function abrirAba(aba: AbaPainel) {
  mudar((e) => ({ aba, painelAberto: e.painelAberto && e.aba === aba ? e.painelAberto : true }));
}

// ---------- abas de projeto ----------

export const fecharAbaProjeto = (pasta: string) => mudar((e) => ({ abasFechadas: [...new Set([...e.abasFechadas, pasta])] }));
export const reabrirAbaProjeto = (pasta: string) => mudar((e) => ({ abasFechadas: e.abasFechadas.filter((p) => p !== pasta) }));

// ---------- tarefas ----------

let seq = 0;
const novoId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

export function adicionarTarefa(texto: string) {
  const t = texto.trim();
  if (!t) return;
  mudar((e) => ({ tarefas: [...e.tarefas, { id: novoId(), texto: t, feita: false, criadaEm: Date.now() }] }));
}

export function alternarTarefa(id: string) {
  mudar((e) => ({
    tarefas: e.tarefas.map((t) => (t.id === id ? { ...t, feita: !t.feita } : t)),
    focoTarefaId: e.focoTarefaId === id && !e.tarefas.find((t) => t.id === id)?.feita ? null : e.focoTarefaId,
  }));
}

export function apagarTarefa(id: string) {
  mudar((e) => ({ tarefas: e.tarefas.filter((t) => t.id !== id), focoTarefaId: e.focoTarefaId === id ? null : e.focoTarefaId }));
}

export const limparConcluidas = () => mudar((e) => ({ tarefas: e.tarefas.filter((t) => !t.feita) }));
export const definirFiltro = (filtro: FiltroTarefas) => mudar(() => ({ filtro }));
export const focarTarefa = (id: string | null) => mudar((e) => ({ focoTarefaId: e.focoTarefaId === id ? null : id }));

/** Ctrl+N: abre o painel em Tarefas e põe o cursor no campo. */
export const pedirNovaTarefa = () => mudar((e) => ({ painelAberto: true, aba: 'tarefas', pedidoNovaTarefa: e.pedidoNovaTarefa + 1 }));

// ---------- notas ----------

export const definirNota = (pasta: string, texto: string) => mudar((e) => ({ notas: { ...e.notas, [pasta]: texto } }));

// ---------- Pomodoro ----------

let relogio: number | undefined;

export function restantePomodoro(p: Pomodoro, agora = Date.now()) {
  return p.rodando && p.fimEm ? Math.max(0, p.fimEm - agora) : p.restanteMs;
}

function vigiar() {
  window.clearInterval(relogio);
  relogio = window.setInterval(() => {
    const p = estado.pomodoro;
    if (!p.rodando) return window.clearInterval(relogio);
    if (restantePomodoro(p) <= 0) {
      window.clearInterval(relogio);
      mudar(() => ({ pomodoro: { rodando: false, fimEm: null, restanteMs: POMODORO_MS, iniciado: false } }));
      const foco = estado.tarefas.find((t) => t.id === estado.focoTarefaId);
      const texto = foco ? `Pomodoro concluído: “${foco.texto}”. Hora de uma pausa.` : 'Pomodoro concluído. Hora de uma pausa.';
      avisar(texto, 'pronto');
      nativo.sistema.tocarSom();
      nativo.sistema.notificar('Hypercube', texto);
    }
  }, 500);
}

export function iniciarPomodoro() {
  const p = estado.pomodoro;
  if (p.rodando) return;
  mudar(() => ({ pomodoro: { rodando: true, iniciado: true, fimEm: Date.now() + p.restanteMs, restanteMs: p.restanteMs } }));
  vigiar();
}

export function pausarPomodoro() {
  const p = estado.pomodoro;
  if (!p.rodando) return;
  mudar(() => ({ pomodoro: { rodando: false, iniciado: true, fimEm: null, restanteMs: restantePomodoro(p) } }));
}

export function zerarPomodoro() {
  window.clearInterval(relogio);
  mudar(() => ({ pomodoro: { rodando: false, fimEm: null, restanteMs: POMODORO_MS, iniciado: false } }));
}

export function formatarTempo(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- projetos (uma pasta = um projeto) ----------

export interface Projeto {
  pasta: string;
  nome: string;
  sessoes: Sessao[];
  terminais: number;
  cor: string;
}

const CORES_PROJETO = [COR_PAPEL.lider, COR_PAPEL.batedor, COR_PAPEL.construtor, COR_PAPEL.revisor, COR_PAPEL.consertador];

export function corDoProjeto(pasta: string) {
  let h = 0;
  for (const c of pasta) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_PROJETO[h % CORES_PROJETO.length];
}

export const nomeDaPasta = (pasta: string) => pasta.split(/[\\/]/).filter(Boolean).pop() ?? pasta;

export function listarProjetos(e: Estado): Projeto[] {
  const mapa = new Map<string, Sessao[]>();
  e.sessoes.forEach((s) => mapa.set(s.pasta, [...(mapa.get(s.pasta) ?? []), s]));
  return [...mapa.entries()].map(([pasta, sessoes]) => ({
    pasta,
    nome: nomeDaPasta(pasta),
    sessoes,
    terminais: e.vertices.filter((v) => !v.paiId && sessoes.some((s) => s.id === v.sessaoId)).length,
    cor: corDoProjeto(pasta),
  }));
}

export function projetoAtivo(e: Estado): string | null {
  return e.sessoes.find((s) => s.id === e.sessaoAtivaId)?.pasta ?? null;
}
