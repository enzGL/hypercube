// Estado do app: sessões, agentes, telas e avisos. Fala com o sistema só por `nativo`.
import { useSyncExternalStore } from 'react';
import { nativo, NOME_AGENTE, type Agente, type EventoAgente } from '../nativo';

export type Papel = 'lider' | 'batedor' | 'construtor' | 'revisor' | 'consertador' | 'subagente';
export type EstadoVertice = 'trabalhando' | 'esperando' | 'pronto' | 'erro';
export type Nivel = 'barato' | 'padrao' | 'forte';
export type Tela = 'inicio' | 'sessoes' | 'orquestracao' | 'imagens' | 'roteador' | 'sobre';
export type Layout = 'auto' | 'foco' | 'livre';
export type EstadoHiper = 'repouso' | 'atencao' | 'processando' | 'sucesso' | 'erro';

export const NOME_PAPEL: Record<Papel, string> = {
  lider: 'Líder',
  batedor: 'Batedor',
  construtor: 'Construtor',
  revisor: 'Revisor',
  consertador: 'Consertador',
  subagente: 'Subagente',
};

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  lider: 'Planeja, divide a tarefa e junta os resultados',
  batedor: 'Explora o projeto e acha o que importa',
  construtor: 'Escreve o código no seu worktree',
  revisor: 'Revisa o diff dos outros, só lendo',
  consertador: 'Corrige o que a revisão ou os testes apontaram',
  subagente: 'Criado por outro agente',
};

export const COR_PAPEL: Record<Papel, string> = {
  lider: '#2238C4',
  batedor: '#2E9C8F',
  construtor: '#C27A12',
  revisor: '#8A5BD6',
  consertador: '#C2475A',
  subagente: '#4B5A93',
};

export const NOME_NIVEL: Record<Nivel, string> = { barato: 'Barato', padrao: 'Padrão', forte: 'Forte' };

export const ESTADO_INFO: Record<EstadoVertice, { simbolo: string; cor: string; nome: string }> = {
  trabalhando: { simbolo: '◐', cor: '#93A4FF', nome: 'Trabalhando' },
  esperando: { simbolo: '◆', cor: '#E9A21B', nome: 'Esperando você' },
  pronto: { simbolo: '●', cor: '#4CC38A', nome: 'Pronto' },
  erro: { simbolo: '✕', cor: '#F0646E', nome: 'Erro' },
};

export interface Vertice {
  id: string;
  sessaoId: string;
  nome: string;
  papel: Papel;
  agente: Agente;
  nivel: Nivel;
  estado: EstadoVertice;
  paiId?: string;
  chaveSub?: string;
  terminalId?: string;
  worktree?: string;
  custo: number;
  tokens: number;
  diff: { mais: number; menos: number };
  oculto: boolean;
  esperandoDesde?: number;
  pergunta?: string;
  ultimaAcao?: string;
  tarefa?: string;
  corridaId?: string;
  atualizadoEm: number;
  /** Apelido dado pela pessoa (ver `renomearAgente`). */
  apelido?: string;
  /** Cor escolhida pela pessoa (ver `definirCorAgente`). */
  cor?: string;
}

export interface Sessao {
  id: string;
  nome: string;
  pasta: string;
  worktrees: boolean;
}

export interface Corrida {
  id: string;
  sessaoId: string;
  tarefa: string;
  ids: string[];
  escolhido?: string;
}

export interface Aviso {
  id: string;
  texto: string;
  tipo: EstadoVertice | 'info';
  verticeId?: string;
}

export type Dialogo = null | { tipo: 'novaSessao' } | { tipo: 'novoVertice'; sessaoId: string; papel?: Papel };

export interface Estado {
  configurado: boolean;
  tela: Tela;
  sessoes: Sessao[];
  vertices: Vertice[];
  sessaoAtivaId: string | null;
  focoId: string | null;
  layout: Layout;
  colunasLivres: number;
  ordem: Record<string, string[]>;
  corridas: Corrida[];
  avisos: Aviso[];
  sucessoAte: number;
  dialogo: Dialogo;
  pastasAbertas: Record<string, boolean>;
}

const CHAVE_CONFIG = 'hypercube.config';

let estado: Estado = {
  configurado: false,
  tela: 'inicio',
  sessoes: [],
  vertices: [],
  sessaoAtivaId: null,
  focoId: null,
  layout: 'auto',
  colunasLivres: 2,
  ordem: {},
  corridas: [],
  avisos: [],
  sucessoAte: 0,
  dialogo: null,
  pastasAbertas: {},
};

const ouvintes = new Set<() => void>();

function mudar(f: (e: Estado) => Partial<Estado>) {
  estado = { ...estado, ...f(estado) };
  ouvintes.forEach((o) => o());
  atualizarTitulo();
}

export function useLoja(): Estado {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
  );
}

export const lerEstado = () => estado;

let seq = 0;
const novoId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

function atualizarVertice(id: string, f: (v: Vertice) => Partial<Vertice>) {
  mudar((e) => ({ vertices: e.vertices.map((v) => (v.id === id ? { ...v, ...f(v), atualizadoEm: Date.now() } : v)) }));
}

let tituloAnterior = '';
function atualizarTitulo() {
  const n = estado.vertices.filter((v) => v.estado === 'esperando').length;
  const t = n ? `(${n}) Hypercube` : 'Hypercube';
  if (t !== tituloAnterior) {
    tituloAnterior = t;
    nativo.sistema.definirTitulo(t);
  }
}

export function avisar(texto: string, tipo: Aviso['tipo'] = 'info', verticeId?: string) {
  const id = novoId('a');
  mudar((e) => ({ avisos: [...e.avisos.slice(-2), { id, texto, tipo, verticeId }] }));
  window.setTimeout(() => fecharAviso(id), 6000);
}

export function fecharAviso(id: string) {
  mudar((e) => ({ avisos: e.avisos.filter((a) => a.id !== id) }));
}

// ---------- derivados ----------

export function estadoHiper(vs: Vertice[], sucessoAte: number): EstadoHiper {
  if (vs.some((v) => v.estado === 'erro')) return 'erro';
  if (vs.some((v) => v.estado === 'esperando')) return 'atencao';
  if (vs.some((v) => v.estado === 'trabalhando')) return 'processando';
  if (Date.now() < sucessoAte) return 'sucesso';
  return 'repouso';
}

export function contar(vs: Vertice[]) {
  const principais = vs.filter((v) => v.papel !== 'subagente');
  return {
    agentes: principais.length,
    trabalhando: principais.filter((v) => v.estado === 'trabalhando').length,
    esperando: vs.filter((v) => v.estado === 'esperando').length,
    prontos: principais.filter((v) => v.estado === 'pronto').length,
    erros: vs.filter((v) => v.estado === 'erro').length,
  };
}

export const verticesDaSessao = (e: Estado, sessaoId: string | null) => e.vertices.filter((v) => v.sessaoId === sessaoId);

export function ordenados(e: Estado, sessaoId: string): Vertice[] {
  const principais = e.vertices.filter((v) => v.sessaoId === sessaoId && !v.paiId);
  const ordem = e.ordem[sessaoId] ?? [];
  return [...principais].sort((a, b) => {
    const ia = ordem.indexOf(a.id);
    const ib = ordem.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

// ---------- eventos dos hooks ----------

function aoEvento(ev: EventoAgente) {
  const v = estado.vertices.find((x) => x.terminalId === ev.terminalId);
  if (!v) return;
  const soma = (x: Vertice) => ({
    tokens: x.tokens + (ev.tokens ?? 0),
    custo: x.custo + (ev.custo ?? 0),
    diff: ev.diff ? { mais: x.diff.mais + ev.diff.mais, menos: x.diff.menos + ev.diff.menos } : x.diff,
  });

  switch (ev.tipo) {
    case 'SessionStart':
      break;
    case 'UserPromptSubmit':
      atualizarVertice(v.id, (x) => ({
        estado: 'trabalhando',
        pergunta: undefined,
        esperandoDesde: undefined,
        tarefa: ev.mensagem === 'Permitido' || ev.mensagem === 'Negado' ? x.tarefa : ev.mensagem,
        ultimaAcao: ev.mensagem === 'Permitido' ? 'Permissão dada' : ev.mensagem === 'Negado' ? 'Permissão negada' : 'Recebeu a tarefa',
      }));
      break;
    case 'PreToolUse':
      atualizarVertice(v.id, (x) => ({ ...soma(x), estado: 'trabalhando', ultimaAcao: `Usando ${ev.ferramenta}` }));
      break;
    case 'Notification': {
      atualizarVertice(v.id, (x) => ({ ...soma(x), estado: 'esperando', pergunta: ev.mensagem, esperandoDesde: ev.momento, ultimaAcao: 'Pediu permissão' }));
      const texto = `${nomeDoAgente(v)} está esperando você: ${ev.mensagem}`;
      avisar(texto, 'esperando', v.id);
      nativo.sistema.notificar('Hypercube', texto);
      nativo.sistema.tocarSom();
      break;
    }
    case 'Stop':
      atualizarVertice(v.id, (x) => ({ ...soma(x), estado: 'pronto', pergunta: undefined, esperandoDesde: undefined, ultimaAcao: ev.mensagem ?? 'Concluiu' }));
      mudar(() => ({ sucessoAte: Date.now() + 3500 }));
      {
        // Só avisa quando a pessoa não está vendo o terminal.
        const visivel = estado.tela === 'sessoes' && estado.sessaoAtivaId === v.sessaoId && !v.oculto;
        if (!visivel && ev.mensagem !== 'Interrompido') {
          const sessao = estado.sessoes.find((s) => s.id === v.sessaoId);
          avisar(`${nomeDoAgente(v)} terminou${sessao && sessao.id !== estado.sessaoAtivaId ? ` em “${sessao.nome}”` : ''}.`, 'pronto', v.id);
        }
      }
      window.setTimeout(() => mudar(() => ({})), 3600);
      break;
    case 'Erro':
      atualizarVertice(v.id, () => ({ estado: 'erro', ultimaAcao: ev.mensagem }));
      avisar(`${nomeDoAgente(v)}: ${ev.mensagem}`, 'erro', v.id);
      nativo.sistema.notificar('Hypercube', `${nomeDoAgente(v)}: ${ev.mensagem}`);
      break;
    case 'SubagentStart': {
      const filho: Vertice = {
        id: novoId('v'),
        sessaoId: v.sessaoId,
        nome: ev.mensagem ?? 'Subagente',
        papel: 'subagente',
        agente: v.agente,
        nivel: v.nivel,
        estado: 'trabalhando',
        paiId: v.id,
        chaveSub: ev.subagenteId,
        custo: 0,
        tokens: 0,
        diff: { mais: 0, menos: 0 },
        oculto: false,
        atualizadoEm: Date.now(),
      };
      mudar((e) => ({ vertices: [...e.vertices, filho] }));
      break;
    }
    case 'SubagentStop': {
      const filho = [...estado.vertices].reverse().find((x) => x.paiId === v.id && x.chaveSub === ev.subagenteId && x.estado === 'trabalhando');
      if (filho) atualizarVertice(filho.id, (x) => ({ estado: 'pronto', tokens: x.tokens + (ev.tokens ?? 0), custo: x.custo + (ev.custo ?? 0) }));
      atualizarVertice(v.id, (x) => soma(x));
      break;
    }
  }
}

nativo.eventos.aoEvento(aoEvento);

// ---------- ações ----------

function nomeLivre(sessaoId: string, papel: Papel): string {
  const base = NOME_PAPEL[papel];
  const usados = estado.vertices.filter((v) => v.sessaoId === sessaoId && v.nome.startsWith(base)).length;
  return usados ? `${base} ${usados + 1}` : base;
}

export async function criarVertice(
  sessaoId: string,
  papel: Papel,
  agente: Agente,
  nivel: Nivel,
  tarefa?: string,
  extra: Partial<Vertice> = {},
): Promise<Vertice> {
  const sessao = estado.sessoes.find((s) => s.id === sessaoId)!;
  const nome = extra.nome ?? nomeLivre(sessaoId, papel);
  const worktree = sessao.worktrees && papel !== 'revisor' && papel !== 'lider'
    ? await nativo.processos.criarWorktree(sessao.pasta, nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-'))
    : undefined;
  // No app nativo a tarefa vai junto com o terminal (o agente pode abrir pedindo para confiar na pasta).
  const tarefaNativa = nativo.modo === 'tauri' ? tarefa : undefined;
  const terminalId = await nativo.terminais.criar({ agente, pasta: sessao.pasta, rotulo: `${nome} · ${NOME_NIVEL[nivel]}`, worktree, tarefa: tarefaNativa });
  const v: Vertice = {
    id: novoId('v'),
    sessaoId,
    nome,
    papel,
    agente,
    nivel,
    estado: 'pronto',
    terminalId,
    worktree,
    custo: 0,
    tokens: 0,
    diff: { mais: 0, menos: 0 },
    oculto: false,
    ultimaAcao: 'Aberto',
    atualizadoEm: Date.now(),
    ...extra,
  };
  mudar((e) => ({
    vertices: [...e.vertices, v],
    ordem: { ...e.ordem, [sessaoId]: [...(e.ordem[sessaoId] ?? []), v.id] },
  }));
  if (tarefa && !tarefaNativa) window.setTimeout(() => mandar(v.id, tarefa), 120);
  return v;
}

export function criarSessao(nome: string, pasta: string, worktrees: boolean): Sessao {
  const s: Sessao = { id: novoId('s'), nome, pasta, worktrees };
  mudar((e) => ({
    sessoes: [...e.sessoes, s],
    sessaoAtivaId: s.id,
    focoId: null,
    tela: 'sessoes',
    pastasAbertas: { ...e.pastasAbertas, [pasta]: true },
  }));
  return s;
}

export function mandar(verticeId: string, texto: string) {
  const v = estado.vertices.find((x) => x.id === verticeId);
  if (!v?.terminalId) return;
  nativo.terminais.escrever(v.terminalId, `${texto}\r`);
}

export function mandarParaTodos(sessaoId: string, texto: string) {
  estado.vertices
    .filter((v) => v.sessaoId === sessaoId && v.terminalId && !v.corridaId)
    .forEach((v) => mandar(v.id, texto));
}

export function responder(verticeId: string, sim: boolean) {
  const v = estado.vertices.find((x) => x.id === verticeId);
  if (!v?.terminalId) return;
  if (nativo.modo !== 'tauri') {
    nativo.terminais.escrever(v.terminalId, sim ? 's' : 'n');
    return;
  }
  // Claude Code: o pedido de confiar na pasta é um menu com "No, exit" marcado (seta para baixo + Enter
  // escolhe "Yes"); os pedidos de permissão aceitam 1 para sim e Esc para não.
  const confiar = v.pergunta?.startsWith('Confiar nesta pasta');
  const tecla = confiar ? (sim ? '\x1b[B\r' : '\r') : sim ? '1' : '\x1b';
  nativo.terminais.escrever(v.terminalId, tecla);
  atualizarVertice(v.id, () => ({ estado: 'trabalhando', pergunta: undefined, esperandoDesde: undefined, ultimaAcao: sim ? 'Permissão dada' : 'Permissão negada' }));
}

export function interromper(verticeId: string) {
  const v = estado.vertices.find((x) => x.id === verticeId);
  if (v?.terminalId) nativo.terminais.escrever(v.terminalId, '\x1b');
}

/** Fechar o painel só esconde: o processo continua rodando. */
export function ocultar(verticeId: string, oculto = true) {
  atualizarVertice(verticeId, () => ({ oculto }));
  if (oculto && estado.focoId === verticeId) mudar(() => ({ focoId: null }));
}

export async function encerrar(verticeId: string) {
  const v = estado.vertices.find((x) => x.id === verticeId);
  if (!v) return;
  if (v.terminalId) await nativo.terminais.encerrar(v.terminalId);
  mudar((e) => ({
    vertices: e.vertices.filter((x) => x.id !== verticeId && x.paiId !== verticeId),
    focoId: e.focoId === verticeId ? null : e.focoId,
  }));
}

export function focar(verticeId: string | null) {
  const v = estado.vertices.find((x) => x.id === verticeId);
  const alvo = v?.paiId ? v.paiId : verticeId;
  mudar(() => ({
    focoId: alvo,
    ...(v ? { sessaoAtivaId: v.sessaoId, tela: 'sessoes' as Tela } : {}),
  }));
  if (v?.oculto) ocultar(v.id, false);
}

export function irPara(tela: Tela) {
  mudar(() => ({ tela }));
}

export function selecionarSessao(id: string) {
  mudar((e) => ({ sessaoAtivaId: id, focoId: null, tela: e.tela === 'sobre' || e.tela === 'roteador' ? 'sessoes' : e.tela }));
}

export function alternarPasta(pasta: string) {
  mudar((e) => ({ pastasAbertas: { ...e.pastasAbertas, [pasta]: !(e.pastasAbertas[pasta] ?? true) } }));
}

export function definirLayout(layout: Layout) {
  mudar(() => ({ layout }));
}

export function definirColunas(n: number) {
  mudar(() => ({ colunasLivres: Math.max(1, Math.min(4, n)) }));
}

export function mover(sessaoId: string, deId: string, paraId: string) {
  if (deId === paraId) return;
  const atual = ordenados(estado, sessaoId).map((v) => v.id);
  const sem = atual.filter((x) => x !== deId);
  sem.splice(sem.indexOf(paraId) + (atual.indexOf(deId) < atual.indexOf(paraId) ? 1 : 0), 0, deId);
  mudar((e) => ({ ordem: { ...e.ordem, [sessaoId]: sem } }));
}

export function abrirDialogo(d: Dialogo) {
  mudar(() => ({ dialogo: d }));
}

/** Alt+N: vai para o agente que espera há mais tempo. */
export function irParaQuemEspera() {
  const v = estado.vertices
    .filter((x) => x.estado === 'esperando')
    .sort((a, b) => (a.esperandoDesde ?? 0) - (b.esperandoDesde ?? 0))[0];
  if (v) focar(v.id);
  else avisar('Ninguém está esperando você agora.');
}

/** Corrida: 2 a 4 agentes na mesma tarefa; a pessoa escolhe o melhor. */
export async function iniciarCorrida(sessaoId: string, tarefa: string, quantos: number) {
  const n = Math.max(2, Math.min(4, quantos));
  const id = novoId('c');
  const agentes: Agente[] = ['claude', 'codex', 'gemini', 'claude'];
  const ids: string[] = [];
  mudar((e) => ({ corridas: [...e.corridas, { id, sessaoId, tarefa, ids }] }));
  for (let i = 0; i < n; i++) {
    const v = await criarVertice(sessaoId, 'construtor', agentes[i], 'padrao', tarefa, { nome: `Corrida ${i + 1}`, corridaId: id });
    ids.push(v.id);
  }
  mudar((e) => ({ corridas: e.corridas.map((c) => (c.id === id ? { ...c, ids: [...ids] } : c)), layout: 'auto' }));
  avisar(`Corrida com ${n} agentes começou.`);
}

export function escolherVencedor(corridaId: string, verticeId: string) {
  const c = estado.corridas.find((x) => x.id === corridaId);
  if (!c) return;
  c.ids.filter((x) => x !== verticeId).forEach((x) => encerrar(x));
  mudar((e) => ({ corridas: e.corridas.map((x) => (x.id === corridaId ? { ...x, escolhido: verticeId } : x)) }));
  atualizarVertice(verticeId, () => ({ corridaId: undefined, nome: nomeLivre(c.sessaoId, 'construtor') }));
  avisar('Vencedor escolhido. Os outros worktrees foram descartados.', 'pronto');
}

/** Revisão cruzada: um agente revisa o diff do outro só lendo. */
export async function revisaoCruzada(alvoId: string) {
  const alvo = estado.vertices.find((x) => x.id === alvoId);
  if (!alvo) return;
  const agente: Agente = alvo.agente === 'claude' ? 'codex' : 'claude';
  await criarVertice(alvo.sessaoId, 'revisor', agente, 'padrao', `Revise o diff do ${alvo.nome}, só lendo`, { nome: `Revisor de ${alvo.nome}` });
}

// ---------- primeira abertura ----------

function salvarConfig(c: { modo: 'exemplo' } | { modo: 'vazio'; pasta: string }) {
  try {
    localStorage.setItem(CHAVE_CONFIG, JSON.stringify(c));
  } catch {
    /* sem armazenamento */
  }
}

export async function comecarComExemplo(salvar = true) {
  if (salvar) salvarConfig({ modo: 'exemplo' });
  mudar(() => ({ configurado: true }));
  const loja = criarSessao('Checkout novo', 'C:\\Projetos\\loja-online', true);
  const blog = criarSessao('Blog', 'C:\\Projetos\\site-pessoal', false);
  const integra = criarSessao('Testes de integração', 'C:\\Projetos\\loja-online', false);
  criarSessao('Ideias', 'C:\\Projetos\\site-pessoal', false);

  await criarVertice(loja.id, 'lider', 'claude', 'forte', 'Divida a correção da cobrança dupla entre os agentes');
  await criarVertice(loja.id, 'batedor', 'gemini', 'barato', 'Mapeie onde o pedido é cobrado');
  await criarVertice(loja.id, 'construtor', 'codex', 'padrao', 'Crie a nova tentativa de pagamento sem cobrar duas vezes');
  await criarVertice(loja.id, 'revisor', 'claude', 'padrao', 'Revise o diff do Construtor');
  await criarVertice(blog.id, 'construtor', 'claude', 'padrao', 'Liste os posts sem imagem de capa');
  await criarVertice(integra.id, 'construtor', 'terminal', 'barato', 'npm run test:integracao', { nome: 'Terminal' });
  mudar(() => ({ sessaoAtivaId: loja.id }));
}

export function comecarVazio(pasta: string) {
  salvarConfig({ modo: 'vazio', pasta });
  mudar(() => ({ configurado: true }));
  const nome = pasta.split(/[\\/]/).filter(Boolean).pop() ?? 'Projeto';
  criarSessao(nome, pasta, true);
}

export function refazerPrimeiraAbertura() {
  try {
    localStorage.removeItem(CHAVE_CONFIG);
  } catch {
    /* ignorar */
  }
  estado.vertices.forEach((v) => v.terminalId && nativo.terminais.encerrar(v.terminalId));
  mudar(() => ({ configurado: false, sessoes: [], vertices: [], ordem: {}, corridas: [], sessaoAtivaId: null, focoId: null, tela: 'sessoes', avisos: [] }));
}

export function restaurarConfig() {
  // `?exemplo` abre direto com a sessão de exemplo (útil para demonstrar).
  const busca = new URLSearchParams(window.location.search);
  if (busca.has('exemplo')) {
    const tela = busca.get('tela') as Tela | null;
    const nomeSessao = busca.get('sessao');
    comecarComExemplo(false).then(() => {
      const s = estado.sessoes.find((x) => x.nome === nomeSessao);
      mudar(() => ({ ...(tela ? { tela } : {}), ...(s ? { sessaoAtivaId: s.id } : {}) }));
    });
    return;
  }
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE_CONFIG) ?? 'null');
    if (c?.modo === 'exemplo') comecarComExemplo(false);
    else if (c?.modo === 'vazio' && typeof c.pasta === 'string') comecarVazio(c.pasta);
  } catch {
    /* primeira vez */
  }
}

export { NOME_AGENTE };

// ---------- Início (acrescentado pelo agente inicio) ----------

/** Nome que aparece na saudação. Fica em `hypercube.nome`; vazio quando ninguém definiu. */
export function nomeUsuario(): string {
  try {
    return (localStorage.getItem('hypercube.nome') ?? '').trim();
  } catch {
    return '';
  }
}

/**
 * Mensagens trocadas com os agentes por dia, do mais antigo (89 dias atrás) até hoje.
 * Enquanto não há histórico real, gera uma série estável (mesma para o mesmo dia)
 * e soma o que os agentes abertos já fizeram hoje.
 */
export function atividade90Dias(): number[] {
  const hoje = Math.floor(Date.now() / 86_400_000);
  const dias: number[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = hoje - i;
    let x = (d * 2654435761) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 2246822519) >>> 0;
    x = (x ^ (x >>> 13)) >>> 0;
    const ruido = (x % 1000) / 1000;
    const semana = new Date(d * 86_400_000).getUTCDay();
    const fimDeSemana = semana === 0 || semana === 6 ? 0.45 : 1;
    const tendencia = 0.55 + (0.45 * (90 - i)) / 90;
    dias.push(Math.round((280 + ruido * 900) * fimDeSemana * tendencia));
  }
  dias[89] += estado.vertices.filter((v) => v.tokens > 0).length * 12;
  return dias;
}

// ---------- painel de orquestração (seletores) ----------

/** Planners da sessão: os agentes líderes, na ordem em que aparecem. */
export function lideresDaSessao(e: Estado, sessaoId: string | null): Vertice[] {
  return ordenados(e, sessaoId ?? '').filter((v) => v.papel === 'lider');
}

/**
 * Workers de um planner: os subagentes que ele criou e, para o primeiro líder da
 * sessão, os outros agentes principais (é ele quem divide o trabalho entre eles).
 */
export function trabalhadoresDoLider(e: Estado, liderId: string | null): Vertice[] {
  const lider = e.vertices.find((v) => v.id === liderId);
  if (!lider) return [];
  const primeiro = lideresDaSessao(e, lider.sessaoId)[0]?.id === lider.id;
  const principais = primeiro ? ordenados(e, lider.sessaoId).filter((v) => v.papel !== 'lider') : [];
  const filhos = e.vertices.filter((v) => v.paiId === lider.id);
  return [...principais, ...filhos];
}

export interface ResumoOrquestracao {
  total: number;
  concluidos: number;
  porcento: number;
  rodando: number;
  naFila: number;
  esperando: number;
  interrompidos: number;
  falhou: number;
  encerrados: number;
  vagasEmUso: number;
  limite: number;
}

/** Contas do resumo. Quem trabalha além do limite de vagas conta como "na fila". */
export function resumoOrquestracao(ws: Vertice[], limite: number): ResumoOrquestracao {
  const trabalhando = ws.filter((v) => v.estado === 'trabalhando').length;
  const esperando = ws.filter((v) => v.estado === 'esperando').length;
  const interrompidos = ws.filter((v) => v.estado === 'pronto' && v.ultimaAcao === 'Interrompido').length;
  const falhou = ws.filter((v) => v.estado === 'erro').length;
  const encerrados = ws.filter((v) => v.estado === 'pronto' && v.ultimaAcao !== 'Interrompido').length;
  const rodando = Math.min(trabalhando, limite);
  const concluidos = encerrados + falhou + interrompidos;
  return {
    total: ws.length,
    concluidos,
    porcento: ws.length ? Math.round((concluidos / ws.length) * 100) : 0,
    rodando,
    naFila: Math.max(0, trabalhando - limite),
    esperando,
    interrompidos,
    falhou,
    encerrados,
    vagasEmUso: Math.min(limite, rodando + esperando),
    limite,
  };
}

// ---------- agentes do jeito da pessoa (acrescentado pelo agente agentes) ----------

/** Personalização de um agente ou de um papel. Campo ausente = usa o padrão. */
export interface Personalizacao {
  apelido?: string;
  cor?: string;
}

interface Personalizacoes {
  porAgente: Record<string, Personalizacao>;
  porPapel: Partial<Record<Papel, Personalizacao>>;
}

const CHAVE_AGENTES = 'hypercube.agentes';

/** 10 cores que conversam com a identidade Noite e ficam longe das cores de estado. */
export const PALETA_AGENTES: { cor: string; nome: string }[] = [
  { cor: '#2238C4', nome: 'Cobalto' },
  { cor: '#5468E0', nome: 'Anil' },
  { cor: '#93A4FF', nome: 'Lavanda' },
  { cor: '#3B8FC4', nome: 'Céu' },
  { cor: '#2E9C8F', nome: 'Petróleo' },
  { cor: '#8A5BD6', nome: 'Violeta' },
  { cor: '#B5579E', nome: 'Ameixa' },
  { cor: '#C2475A', nome: 'Framboesa' },
  { cor: '#C27A12', nome: 'Cobre' },
  { cor: '#4B5A93', nome: 'Ardósia' },
];

function lerPersonalizacoes(): Personalizacoes {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_AGENTES) ?? 'null');
    if (p && typeof p === 'object') return { porAgente: p.porAgente ?? {}, porPapel: p.porPapel ?? {} };
  } catch {
    /* sem armazenamento ou JSON quebrado */
  }
  return { porAgente: {}, porPapel: {} };
}

let personalizacoes: Personalizacoes = lerPersonalizacoes();

function gravarPersonalizacoes() {
  try {
    localStorage.setItem(CHAVE_AGENTES, JSON.stringify(personalizacoes));
  } catch {
    /* sem armazenamento: vale só nesta abertura */
  }
}

/**
 * Chave estável do agente entre aberturas: o id muda a cada vez que o app abre,
 * então a personalização fica presa à pasta, à sessão e ao nome original.
 */
export function chaveAgente(v: Vertice): string {
  const s = estado.sessoes.find((x) => x.id === v.sessaoId);
  return `${s?.pasta ?? ''}|${s?.nome ?? ''}|${v.nome}`;
}

const corValida = (c: string | undefined) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined);

/** Apelido e cor padrão de um papel (o que a pessoa escolheu ou o de fábrica). */
export function padraoDoPapel(papel: Papel): { apelido: string; cor: string } {
  const p = personalizacoes.porPapel[papel] ?? {};
  return { apelido: p.apelido?.trim() || NOME_PAPEL[papel], cor: corValida(p.cor) ?? COR_PAPEL[papel] };
}

/** Nome que aparece para a pessoa: apelido do agente, depois o padrão do papel, depois o nome. */
export function nomeDoAgente(v: Vertice): string {
  const proprio = v.apelido?.trim() || personalizacoes.porAgente[chaveAgente(v)]?.apelido?.trim();
  return proprio || nomePadraoDoAgente(v);
}

/** Nome que o agente teria sem apelido próprio (segue o padrão do papel). */
export function nomePadraoDoAgente(v: Vertice): string {
  const doPapel = personalizacoes.porPapel[v.papel]?.apelido?.trim();
  const base = NOME_PAPEL[v.papel];
  // "Batedor 2" com o padrão "Olheiro" vira "Olheiro 2"; nomes próprios ("Corrida 1") ficam.
  if (doPapel && v.nome.startsWith(base)) return doPapel + v.nome.slice(base.length);
  return v.nome;
}

/** Cor do agente: a dele, depois a do papel. */
export function corDoAgente(v: Vertice): string {
  return corValida(v.cor) ?? corValida(personalizacoes.porAgente[chaveAgente(v)]?.cor) ?? padraoDoPapel(v.papel).cor;
}

/** Se o agente tem apelido ou cor só dele. */
export function agentePersonalizado(v: Vertice): boolean {
  const p = personalizacoes.porAgente[chaveAgente(v)];
  return !!(v.apelido || v.cor || p?.apelido || p?.cor);
}

function guardarDoAgente(id: string, f: (p: Personalizacao) => Personalizacao) {
  const v = estado.vertices.find((x) => x.id === id);
  if (!v) return;
  const chave = chaveAgente(v);
  const novo = f({ ...personalizacoes.porAgente[chave] });
  const porAgente = { ...personalizacoes.porAgente };
  if (novo.apelido || novo.cor) porAgente[chave] = novo;
  else delete porAgente[chave];
  personalizacoes = { ...personalizacoes, porAgente };
  gravarPersonalizacoes();
  atualizarVertice(id, () => ({ apelido: novo.apelido, cor: novo.cor }));
}

/** Dá um apelido ao agente. Vazio volta ao nome padrão. */
export function renomearAgente(id: string, apelido: string) {
  const a = apelido.trim().slice(0, 40);
  guardarDoAgente(id, (p) => ({ ...p, apelido: a || undefined }));
}

/** Troca a cor do agente (#rrggbb). Vazio volta à cor do papel. */
export function definirCorAgente(id: string, cor: string) {
  guardarDoAgente(id, (p) => ({ ...p, cor: corValida(cor) }));
}

/** Tira o apelido e a cor do agente: volta ao padrão do papel. */
export function restaurarAgente(id: string) {
  guardarDoAgente(id, () => ({}));
}

/** Define o padrão de um papel (vale para todos os agentes desse papel sem apelido ou cor próprios). */
export function definirPadraoPapel(papel: Papel, p: Personalizacao) {
  const apelido = p.apelido?.trim().slice(0, 40);
  const cor = corValida(p.cor);
  const porPapel = { ...personalizacoes.porPapel };
  const valeApelido = apelido && apelido !== NOME_PAPEL[papel] ? apelido : undefined;
  const valeCor = cor && cor.toLowerCase() !== COR_PAPEL[papel].toLowerCase() ? cor : undefined;
  if (valeApelido || valeCor) porPapel[papel] = { apelido: valeApelido, cor: valeCor };
  else delete porPapel[papel];
  personalizacoes = { ...personalizacoes, porPapel };
  gravarPersonalizacoes();
  mudar((e) => ({ vertices: e.vertices.map((v) => (v.papel === papel ? { ...v } : v)) }));
}

/** Volta o papel ao apelido e à cor de fábrica. */
export function restaurarPadraoPapel(papel: Papel) {
  definirPadraoPapel(papel, {});
}
