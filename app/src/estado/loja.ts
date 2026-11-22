// Estado do app: sessões, agentes, telas e avisos. Fala com o sistema só por `nativo`.
import { useSyncExternalStore } from 'react';
import { nativo, NOME_AGENTE, type Agente, type EventoAgente, type PedidoOrquestrador } from '../nativo';
import { esforcoDoNivel, INSTRUCAO_PAPEL, mensagemComPapel, modeloDoNivel, PRECISA_COPIA, SO_LEITURA } from './papeis';

/** 'agente' é o comum, sem papel. Os outros são agentes predefinidos, opcionais, cada um com a sua skill. */
export type Papel = 'agente' | 'lider' | 'batedor' | 'construtor' | 'revisor' | 'consertador' | 'subagente';
export type EstadoVertice = 'trabalhando' | 'esperando' | 'pronto' | 'erro';
export type Nivel = 'barato' | 'padrao' | 'forte';
export type Tela = 'inicio' | 'sessoes' | 'orquestracao' | 'imagens' | 'roteador' | 'sobre';
export type Layout = 'auto' | 'foco' | 'livre';
export type EstadoHiper = 'repouso' | 'atencao' | 'processando' | 'sucesso' | 'erro';

export const NOME_PAPEL: Record<Papel, string> = {
  agente: 'Agente',
  lider: 'Líder',
  batedor: 'Explorador',
  construtor: 'Construtor',
  revisor: 'Revisor',
  consertador: 'Mecânico',
  subagente: 'Subagente',
};

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  agente: 'Um agente comum, sem skill: faz o que você pedir',
  lider: 'Divide o pedido em itens, chama a equipe e prepara o pull request',
  batedor: 'Explora o projeto e acha o que importa, só lendo',
  construtor: 'Escreve o código na sua cópia do projeto',
  revisor: 'Revisa o diff dos outros, só lendo',
  consertador: 'Corrige o que a revisão ou os testes apontaram',
  subagente: 'Criado por outro agente',
};

export const COR_PAPEL: Record<Papel, string> = {
  agente: '#3550E8',
  lider: '#2238C4',
  batedor: '#2E9C8F',
  construtor: '#C27A12',
  revisor: '#8A5BD6',
  consertador: '#C2475A',
  subagente: '#4B5A93',
};

export const NOME_NIVEL: Record<Nivel, string> = { barato: 'Barato', padrao: 'Padrão', forte: 'Forte' };

export const DESCRICAO_NIVEL: Record<Nivel, string> = {
  barato: 'Modelo leve: rápido e gasta pouco do plano. Bom para ler e mapear o código.',
  padrao: 'Equilíbrio entre custo e qualidade. Serve para a maioria das tarefas.',
  forte: 'Modelo mais capaz: pensa melhor e gasta mais. Para planejar e decidir.',
};

const ACAO_FERRAMENTA: Record<string, string> = {
  bash: 'rodar um comando no terminal',
  powershell: 'rodar um comando no terminal',
  edit: 'mudar um arquivo',
  multiedit: 'mudar um arquivo',
  write: 'criar ou reescrever um arquivo',
  notebookedit: 'mudar um notebook',
  read: 'ler um arquivo',
  webfetch: 'abrir uma página da internet',
  websearch: 'pesquisar na internet',
};

/** O pedido de permissão em linguagem direta, e o que cada botão faz. */
export function descreverPedido(pergunta: string): { acao: string; sim: string; nao: string; dicaSim: string; dicaNao: string } {
  if (pergunta.startsWith('Confiar nesta pasta')) {
    return {
      acao: 'quer trabalhar nesta pasta. Confie só se o projeto for seu ou de quem você conhece.',
      sim: 'Confiar na pasta',
      nao: 'Não confiar',
      dicaSim: 'O agente passa a ler e mudar arquivos desta pasta',
      dicaNao: 'O agente fecha sem mexer em nada',
    };
  }
  const m = /permission to use ([\w-]+)/i.exec(pergunta);
  const ferramenta = m?.[1];
  const acao = ferramenta ? ACAO_FERRAMENTA[ferramenta.toLowerCase()] ?? `usar a ferramenta ${ferramenta}` : null;
  return {
    acao: acao ? `quer ${acao}.` : `pede permissão: ${pergunta}`,
    sim: 'Permitir',
    nao: 'Negar',
    dicaSim: acao ? `Deixa o agente ${acao}, só desta vez` : 'Deixa o agente fazer isso, só desta vez',
    dicaNao: 'O agente não faz isso e segue de outro jeito',
  };
}

export const ESTADO_INFO: Record<EstadoVertice, { simbolo: string; cor: string; nome: string }> = {
  trabalhando: { simbolo: '◐', cor: 'var(--trabalhando)', nome: 'Trabalhando' },
  esperando: { simbolo: '◆', cor: 'var(--esperando)', nome: 'Esperando você' },
  pronto: { simbolo: '●', cor: 'var(--pronto)', nome: 'Pronto' },
  erro: { simbolo: '✕', cor: 'var(--erro)', nome: 'Erro' },
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
  /** Líder que criou este agente pelas ferramentas do Hypercube. */
  criadoPor?: string;
  /** Abre em modo só leitura (os papéis que só leem, ou o modo Planejar). */
  soLeitura?: boolean;
  /** O processo terminou (ou o app foi fechado): dá para abrir de novo. */
  encerrado?: boolean;
}

export interface Sessao {
  id: string;
  nome: string;
  pasta: string;
  worktrees: boolean;
  /** Sessão de orquestração (painel com quem divide e quem faz). Sem o campo: sessões antigas, que já tinham o painel. */
  orquestracao?: boolean;
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
/** Sessões, abas e agentes, para voltarem quando o app abrir de novo. */
const CHAVE_SESSOES = 'hypercube.sessoes';

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
  gravarSessoes();
}

let relogioGravar: number | undefined;
/** Guarda as sessões e os agentes (sem o que só vale com o processo rodando). */
function gravarSessoes() {
  if (typeof window === 'undefined') return;
  window.clearTimeout(relogioGravar);
  relogioGravar = window.setTimeout(() => {
    if (!estado.configurado) return;
    const vertices = estado.vertices
      .filter((v) => v.papel !== 'subagente')
      .map(({ terminalId: _t, pergunta: _p, esperandoDesde: _e, ...v }) => v);
    const { sessoes, ordem, sessaoAtivaId, pastasAbertas } = estado;
    try {
      localStorage.setItem(CHAVE_SESSOES, JSON.stringify({ versao: 1, sessoes, vertices, ordem, sessaoAtivaId, pastasAbertas }));
    } catch {
      /* sem armazenamento: vale só nesta abertura */
    }
  }, 300);
}

/**
 * Volta as sessões e os agentes da última vez. Os processos não sobrevivem ao fechar o app:
 * cada agente volta encerrado, com o botão para abrir de novo (sem tarefa, ninguém começa sozinho).
 */
function restaurarSessoes(): boolean {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE_SESSOES) ?? 'null');
    if (!g || !Array.isArray(g.sessoes) || !g.sessoes.length || !Array.isArray(g.vertices)) return false;
    const sessoes: Sessao[] = g.sessoes.filter((s: Sessao) => s && typeof s.id === 'string' && typeof s.pasta === 'string');
    const ids = new Set(sessoes.map((s) => s.id));
    const vertices: Vertice[] = g.vertices
      .filter((v: Vertice) => v && typeof v.id === 'string' && ids.has(v.sessaoId) && v.papel !== 'subagente')
      .map((v: Vertice) => ({
        ...v,
        terminalId: undefined,
        pergunta: undefined,
        esperandoDesde: undefined,
        corridaId: undefined,
        encerrado: true,
        estado: 'pronto' as const,
        ultimaAcao: 'Fechado junto com o app',
        atualizadoEm: Date.now(),
      }));
    mudar(() => ({
      configurado: true,
      sessoes,
      vertices,
      ordem: g.ordem && typeof g.ordem === 'object' ? g.ordem : {},
      sessaoAtivaId: ids.has(g.sessaoAtivaId) ? g.sessaoAtivaId : sessoes[0].id,
      pastasAbertas: g.pastasAbertas && typeof g.pastasAbertas === 'object' ? g.pastasAbertas : {},
    }));
    return true;
  } catch {
    return false;
  }
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
    prontos: principais.filter((v) => v.estado === 'pronto' && !v.encerrado).length,
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
      // Agente criado pelo Líder numa cópia do mesmo projeto: a pessoa já confiou na pasta do Líder.
      if (ev.mensagem?.startsWith('Confiar nesta pasta') && v.criadoPor) {
        atualizarVertice(v.id, () => ({ estado: 'esperando', pergunta: ev.mensagem }));
        window.setTimeout(() => {
          responder(v.id, true);
          atualizarVertice(v.id, () => ({ ultimaAcao: 'Pasta confiada (cópia do projeto do Líder)' }));
        }, 400);
        break;
      }
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

nativo.eventos.aoFim(({ id, codigo }) => {
  const v = estado.vertices.find((x) => x.terminalId === id);
  if (!v) return;
  atualizarVertice(v.id, () => ({
    encerrado: true,
    estado: codigo === 0 ? 'pronto' : 'erro',
    pergunta: undefined,
    esperandoDesde: undefined,
    ultimaAcao: codigo === 0 ? 'Processo encerrado' : `Processo encerrado (código ${codigo})`,
  }));
});

// Agentes sem hooks (Gemini, OpenCode, Kiro): param de trabalhar quando a tela fica parada um tempo.
const SEM_HOOKS: ReadonlySet<Agente> = new Set<Agente>(['gemini', 'opencode', 'kiro']);
window.setInterval(async () => {
  for (const v of estado.vertices) {
    if (v.estado !== 'trabalhando' || !v.terminalId || !SEM_HOOKS.has(v.agente)) continue;
    const ms = await nativo.terminais.ocioso(v.terminalId);
    if (ms !== null && ms > 7000 && Date.now() - v.atualizadoEm > 7000) {
      atualizarVertice(v.id, () => ({ estado: 'pronto', ultimaAcao: 'Parou (tela sem mudar)' }));
    }
  }
}, 2000);

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
  let worktree: string | undefined = extra.worktree;
  if (!worktree && sessao.worktrees && PRECISA_COPIA.has(papel)) {
    try {
      worktree = await nativo.processos.criarWorktree(sessao.pasta, nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-'));
    } catch (erro) {
      // Sem git na pasta: o agente trabalha na pasta do projeto mesmo, e a pessoa fica sabendo.
      avisar(`${nome} vai trabalhar direto na pasta do projeto: não deu para criar a cópia separada (${String(erro)}).`, 'erro');
    }
  }
  // No app nativo a tarefa vai junto com o terminal (o agente pode abrir pedindo para confiar na pasta).
  // O papel vale de verdade: no Claude vai como prompt de sistema; nos outros, junto da primeira mensagem.
  const soLeitura = extra.soLeitura ?? SO_LEITURA.has(papel);
  const { terminalId, tarefaNativa } = await abrirTerminal({ sessao, nome, papel, agente, nivel, worktree, soLeitura }, tarefa);
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
    ultimaAcao: tarefa && tarefaNativa ? 'Recebeu a tarefa' : 'Aberto',
    tarefa,
    atualizadoEm: Date.now(),
    ...extra,
    soLeitura,
    // Com a tarefa já na abertura, o agente começa trabalhando (o Codex e o Gemini não avisam o começo).
    ...(tarefa && tarefaNativa ? { estado: 'trabalhando' as const } : {}),
  };
  mudar((e) => ({
    vertices: [...e.vertices, v],
    ordem: { ...e.ordem, [sessaoId]: [...(e.ordem[sessaoId] ?? []), v.id] },
  }));
  if (tarefa && !tarefaNativa) window.setTimeout(() => mandar(v.id, tarefa), 120);
  return v;
}

interface AberturaTerminal {
  sessao: Sessao;
  nome: string;
  papel: Papel;
  agente: Agente;
  nivel: Nivel;
  worktree?: string;
  soLeitura: boolean;
}

/** Abre o terminal do agente com o papel, o nível e o modo dele. */
async function abrirTerminal(a: AberturaTerminal, tarefa?: string): Promise<{ terminalId: string; tarefaNativa?: string }> {
  // No app nativo a tarefa vai junto com o terminal (o agente pode abrir pedindo para confiar na pasta).
  // O papel vale de verdade: no Claude vai como prompt de sistema; nos outros, junto da primeira mensagem.
  const nativoReal = nativo.modo === 'tauri';
  const comoSistema = a.agente === 'claude';
  const tarefaNativa = nativoReal ? (comoSistema || a.agente === 'terminal' ? tarefa : mensagemComPapel(a.papel, tarefa)) : undefined;
  const terminalId = await nativo.terminais.criar({
    agente: a.agente,
    pasta: a.sessao.pasta,
    rotulo: `${a.nome} · ${NOME_NIVEL[a.nivel]}`,
    worktree: a.worktree,
    tarefa: tarefaNativa,
    instrucao: comoSistema ? INSTRUCAO_PAPEL[a.papel] : undefined,
    modelo: modeloDoNivel(a.agente, a.nivel),
    esforco: esforcoDoNivel(a.agente, a.nivel),
    soLeitura: a.soLeitura,
    orquestrar: a.papel === 'lider',
  });
  return { terminalId, tarefaNativa };
}

/** Abre de novo o terminal de um agente encerrado (sem tarefa: ele espera você). */
export async function reabrir(verticeId: string) {
  const v = estado.vertices.find((x) => x.id === verticeId);
  const sessao = v && estado.sessoes.find((s) => s.id === v.sessaoId);
  if (!v || !sessao) return;
  try {
    const { terminalId } = await abrirTerminal({ sessao, nome: v.nome, papel: v.papel, agente: v.agente, nivel: v.nivel, worktree: v.worktree, soLeitura: !!v.soLeitura });
    atualizarVertice(v.id, () => ({ terminalId, encerrado: false, estado: 'pronto', pergunta: undefined, ultimaAcao: 'Aberto de novo' }));
  } catch (erro) {
    avisar(`Não deu para abrir ${nomeDoAgente(v)}: ${String(erro)}`, 'erro', v.id);
  }
}

export async function reabrirTodos(sessaoId: string) {
  for (const v of estado.vertices.filter((x) => x.sessaoId === sessaoId && x.encerrado && !x.paiId)) await reabrir(v.id);
}

export function criarSessao(nome: string, pasta: string, worktrees: boolean, orquestracao = false): Sessao {
  const s: Sessao = { id: novoId('s'), nome, pasta, worktrees, orquestracao };
  mudar((e) => ({
    sessoes: [...e.sessoes, s],
    sessaoAtivaId: s.id,
    focoId: null,
    tela: 'sessoes',
    pastasAbertas: { ...e.pastasAbertas, [pasta]: true },
  }));
  return s;
}

/** Sessão de orquestração ou terminal padrão. */
export const temOrquestracao = (s: Sessao | undefined) => !!s && s.orquestracao !== false;

export function definirOrquestracao(sessaoId: string, orquestracao: boolean) {
  mudar((e) => ({ sessoes: e.sessoes.map((s) => (s.id === sessaoId ? { ...s, orquestracao } : s)) }));
}

export function mandar(verticeId: string, texto: string) {
  const v = estado.vertices.find((x) => x.id === verticeId);
  if (!v?.terminalId || v.encerrado) return;
  nativo.terminais.enviar(v.terminalId, texto);
  // O Claude avisa pelo hook; os outros começam a trabalhar aqui (o Codex avisa o fim, os demais param quando a tela para).
  if (v.agente !== 'claude' && v.agente !== 'terminal') {
    atualizarVertice(v.id, () => ({ estado: 'trabalhando', tarefa: texto, ultimaAcao: 'Recebeu a tarefa' }));
  }
}

export function mandarParaTodos(sessaoId: string, texto: string) {
  estado.vertices
    .filter((v) => v.sessaoId === sessaoId && v.terminalId && !v.encerrado && !v.corridaId)
    .forEach((v) => mandar(v.id, texto));
}

export function responder(verticeId: string, sim: boolean) {
  const v = estado.vertices.find((x) => x.id === verticeId);
  if (!v?.terminalId) return;
  if (nativo.modo !== 'tauri') {
    nativo.terminais.escrever(v.terminalId, sim ? 's' : 'n');
    return;
  }
  // Confiar na pasta: no Claude o menu abre com "No, exit" marcado (seta para baixo + Enter escolhe "Yes");
  // no Codex e no Gemini a primeira opção já é confiar (Enter) e Esc recusa.
  // Os pedidos de permissão do Claude aceitam 1 para sim e Esc para não.
  const confiar = v.pergunta?.startsWith('Confiar nesta pasta');
  const tecla = confiar
    ? v.agente === 'claude'
      ? sim ? '\x1b[B\r' : '\r'
      : sim ? '\r' : '\x1b'
    : sim ? '1' : '\x1b';
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
    const v = await criarVertice(sessaoId, 'agente', agentes[i], 'padrao', tarefa, { nome: `Corrida ${i + 1}`, corridaId: id });
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
  const loja = criarSessao('Checkout novo', 'C:\\Projetos\\loja-online', true, true);
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
    localStorage.removeItem(CHAVE_SESSOES);
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
  if (restaurarSessoes()) return;
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
  const criados = ordenados(e, lider.sessaoId).filter((v) => v.criadoPor === lider.id);
  // O primeiro líder também mostra os agentes que ninguém criou (é ele quem divide o trabalho entre eles).
  const principais = primeiro ? ordenados(e, lider.sessaoId).filter((v) => v.papel !== 'lider' && !v.criadoPor) : [];
  const filhos = e.vertices.filter((v) => v.paiId === lider.id);
  return [...criados, ...principais, ...filhos];
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

// ---------- ferramentas do Líder (servidor MCP local do Hypercube) ----------

const PAPEIS_DO_LIDER: Papel[] = ['agente', 'batedor', 'construtor', 'revisor', 'consertador'];
const NIVEIS: Nivel[] = ['barato', 'padrao', 'forte'];

/** Limite de agentes rodando ao mesmo tempo (o mesmo do painel de orquestração). */
function limiteDaOrquestracao(): number {
  try {
    const p = JSON.parse(localStorage.getItem('hypercube.orquestracao') ?? 'null');
    if (p && typeof p.limite === 'number') return Math.max(1, Math.min(8, p.limite));
  } catch {
    /* sem armazenamento */
  }
  return 4;
}

function estadoParaLider(v: Vertice): string {
  return v.encerrado ? 'encerrado' : v.estado;
}

function linhaAgente(v: Vertice, lider: Vertice): string {
  const quem = v.id === lider.id ? ' (você)' : v.criadoPor === lider.id ? ' (criado por você)' : '';
  return `- id ${v.id} · ${nomeDoAgente(v)}${quem} · papel ${NOME_PAPEL[v.papel]} (${v.papel}) · ${NOME_AGENTE[v.agente]} · nível ${v.nivel} · ${estadoParaLider(v)} · ${v.ultimaAcao ?? ''}`;
}

const texto = (x: unknown) => (typeof x === 'string' ? x.trim() : '');

async function atenderLider(p: PedidoOrquestrador): Promise<string> {
  const lider = estado.vertices.find((x) => x.terminalId === p.terminalId);
  if (!lider) throw new Error('Este terminal não é de um agente do Hypercube.');
  const daSessao = () => estado.vertices.filter((x) => x.sessaoId === lider.sessaoId && x.papel !== 'subagente');
  const achar = (id: string) => {
    const alvo = daSessao().find((x) => x.id === id);
    if (!alvo) throw new Error(`Não existe agente com id ${id} nesta sessão. Use listar_agentes.`);
    return alvo;
  };
  const a = p.argumentos ?? {};

  switch (p.ferramenta) {
    case 'listar_agentes':
      return daSessao().map((v) => linhaAgente(v, lider)).join('\n') || 'Nenhum agente.';

    case 'criar_agente': {
      const papel = texto(a.papel) as Papel;
      if (!PAPEIS_DO_LIDER.includes(papel)) throw new Error(`Papel inválido. Use um destes: ${PAPEIS_DO_LIDER.join(', ')}.`);
      const tarefa = texto(a.tarefa);
      if (!tarefa) throw new Error('Falta a tarefa.');
      const nivel = (NIVEIS.includes(texto(a.nivel) as Nivel) ? texto(a.nivel) : 'padrao') as Nivel;
      const pedido = texto(a.agente) as Agente;
      const instalados = (await nativo.processos.detectarAgentes()).filter((d) => d.instalado && d.agente !== 'terminal').map((d) => d.agente);
      const agente: Agente = pedido
        ? pedido
        : instalados.includes(lider.agente) ? lider.agente : (instalados[0] ?? 'claude');
      if (!instalados.includes(agente)) throw new Error(`${NOME_AGENTE[agente] ?? agente} não está instalado. Instalados: ${instalados.join(', ')}.`);
      const ativos = daSessao().filter((x) => !x.encerrado);
      if (ativos.filter((x) => x.estado === 'trabalhando' && x.id !== lider.id).length >= limiteDaOrquestracao()) {
        throw new Error(`Limite de ${limiteDaOrquestracao()} agentes trabalhando ao mesmo tempo. Espere um terminar (ferramenta esperar) ou encerre um.`);
      }
      if (ativos.filter((x) => !x.paiId).length >= 8) throw new Error('A sessão já tem 8 agentes abertos (o limite).');
      const nome = texto(a.nome).slice(0, 40) || undefined;
      // Trabalhar na cópia de outro agente (ex.: o Mecânico corrige direto na branch do Construtor).
      const deQuem = texto(a.na_copia_de) ? achar(texto(a.na_copia_de)) : undefined;
      if (deQuem && !deQuem.worktree) throw new Error(`${nomeDoAgente(deQuem)} não tem cópia própria: ele trabalha na pasta do projeto.`);
      const v = await criarVertice(lider.sessaoId, papel, agente, nivel, tarefa, {
        criadoPor: lider.id,
        ...(nome ? { nome } : {}),
        ...(deQuem ? { worktree: deQuem.worktree } : {}),
      });
      avisar(`${nomeDoAgente(lider)} criou ${nomeDoAgente(v)}.`, 'trabalhando', v.id);
      return `Criado: ${nomeDoAgente(v)} (id ${v.id}), ${NOME_PAPEL[papel]} no ${NOME_AGENTE[agente]}, nível ${nivel}${v.worktree ? `, na cópia ${v.worktree}` : ''}. Já recebeu a tarefa. Use esperar e depois ler_resultado.`;
    }

    case 'mandar_tarefa': {
      const alvo = achar(texto(a.id));
      const tarefa = texto(a.tarefa);
      if (!tarefa) throw new Error('Falta a tarefa.');
      if (alvo.id === lider.id) throw new Error('Esse id é o seu.');
      if (alvo.encerrado || !alvo.terminalId) throw new Error(`${nomeDoAgente(alvo)} está encerrado. Crie outro agente.`);
      mandar(alvo.id, tarefa);
      atualizarVertice(alvo.id, () => ({ estado: 'trabalhando', tarefa, ultimaAcao: `Tarefa de ${nomeDoAgente(lider)}` }));
      return `Mandado para ${nomeDoAgente(alvo)}.`;
    }

    case 'esperar': {
      const ids = Array.isArray(a.ids) ? a.ids.map(texto).filter(Boolean) : [];
      const alvos = () =>
        ids.length ? ids.map(achar) : daSessao().filter((x) => x.criadoPor === lider.id);
      if (!alvos().length) return 'Você ainda não criou nenhum agente.';
      const limite = Math.max(5, Math.min(300, Number(a.segundos) || 120)) * 1000;
      const inicio = Date.now();
      // Dá um instante para quem acabou de receber tarefa começar.
      await new Promise((r) => window.setTimeout(r, 1500));
      while (Date.now() - inicio < limite && alvos().some((x) => x.estado === 'trabalhando' && !x.encerrado)) {
        await new Promise((r) => window.setTimeout(r, 1000));
      }
      const vs = alvos();
      const ainda = vs.filter((x) => x.estado === 'trabalhando' && !x.encerrado).length;
      const esperando = vs.filter((x) => x.estado === 'esperando').length;
      return [
        ...vs.map((v) => linhaAgente(v, lider)),
        ainda ? `${ainda} ainda trabalhando: chame esperar de novo.` : 'Nenhum está trabalhando.',
        ...(esperando ? [`${esperando} esperando a pessoa responder um pedido de permissão no Hypercube.`] : []),
      ].join('\n');
    }

    case 'ler_resultado': {
      const alvo = achar(texto(a.id));
      const partes = [`${nomeDoAgente(alvo)} · ${NOME_PAPEL[alvo.papel]} · ${estadoParaLider(alvo)}`];
      if (alvo.pergunta) partes.push(`Esperando a pessoa: ${alvo.pergunta}`);
      if (alvo.terminalId) partes.push(`Última resposta:\n${(await nativo.terminais.resultado(alvo.terminalId)).trim() || '(nada ainda)'}`);
      const sessao = estado.sessoes.find((s) => s.id === alvo.sessaoId);
      if (alvo.worktree && sessao) {
        try {
          partes.push(`Mudanças na cópia dele:\n${await nativo.processos.resumoMudancas(alvo.worktree, sessao.pasta)}`);
        } catch (erro) {
          partes.push(`Não deu para ler as mudanças: ${String(erro)}`);
        }
      }
      return partes.join('\n\n');
    }
  }
  throw new Error(`Ferramenta desconhecida: ${p.ferramenta}`);
}

nativo.orquestrador.aoPedido((p) => {
  atenderLider(p).then(
    (r) => nativo.orquestrador.responder(p.pedido, r),
    (erro) => nativo.orquestrador.responder(p.pedido, erro instanceof Error ? erro.message : String(erro), true),
  );
});
