// Estado do app: sessões, Vértices, telas e avisos. Fala com o sistema só por `nativo`.
import { useSyncExternalStore } from 'react';
import { nativo, NOME_AGENTE, type Agente, type EventoAgente } from '../nativo';

export type Papel = 'lider' | 'batedor' | 'construtor' | 'revisor' | 'consertador' | 'subagente';
export type EstadoVertice = 'trabalhando' | 'esperando' | 'pronto' | 'erro';
export type Nivel = 'barato' | 'padrao' | 'forte';
export type Tela = 'sessoes' | 'orquestracao' | 'imagens' | 'roteador' | 'sobre';
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
  subagente: 'Criado por outro Vértice',
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
  tela: 'sessoes',
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
      const texto = `${v.nome} está esperando você: ${ev.mensagem}`;
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
          avisar(`${v.nome} terminou${sessao && sessao.id !== estado.sessaoAtivaId ? ` em “${sessao.nome}”` : ''}.`, 'pronto', v.id);
        }
      }
      window.setTimeout(() => mudar(() => ({})), 3600);
      break;
    case 'Erro':
      atualizarVertice(v.id, () => ({ estado: 'erro', ultimaAcao: ev.mensagem }));
      avisar(`${v.nome}: ${ev.mensagem}`, 'erro', v.id);
      nativo.sistema.notificar('Hypercube', `${v.nome}: ${ev.mensagem}`);
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
  const terminalId = await nativo.terminais.criar({ agente, pasta: sessao.pasta, rotulo: `${nome} · ${NOME_NIVEL[nivel]}`, worktree });
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
  if (tarefa) window.setTimeout(() => mandar(v.id, tarefa), 120);
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
  if (v?.terminalId) nativo.terminais.escrever(v.terminalId, sim ? 's' : 'n');
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

/** Alt+N: vai para o Vértice que espera há mais tempo. */
export function irParaQuemEspera() {
  const v = estado.vertices
    .filter((x) => x.estado === 'esperando')
    .sort((a, b) => (a.esperandoDesde ?? 0) - (b.esperandoDesde ?? 0))[0];
  if (v) focar(v.id);
  else avisar('Ninguém está esperando você agora.');
}

/** Corrida: 2 a 4 Vértices na mesma tarefa; a pessoa escolhe o melhor. */
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
  avisar(`Corrida com ${n} Vértices começou.`);
}

export function escolherVencedor(corridaId: string, verticeId: string) {
  const c = estado.corridas.find((x) => x.id === corridaId);
  if (!c) return;
  c.ids.filter((x) => x !== verticeId).forEach((x) => encerrar(x));
  mudar((e) => ({ corridas: e.corridas.map((x) => (x.id === corridaId ? { ...x, escolhido: verticeId } : x)) }));
  atualizarVertice(verticeId, () => ({ corridaId: undefined, nome: nomeLivre(c.sessaoId, 'construtor') }));
  avisar('Vencedor escolhido. Os outros worktrees foram descartados.', 'pronto');
}

/** Revisão cruzada: um Vértice revisa o diff do outro só lendo. */
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

  await criarVertice(loja.id, 'lider', 'claude', 'forte', 'Divida a correção da cobrança dupla entre os Vértices');
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
