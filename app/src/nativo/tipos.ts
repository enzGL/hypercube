// Contrato entre a interface e o sistema (terminais, arquivos, processos).
// Hoje existe uma versão simulada (simulado.ts). No Tauri 2, tauri.ts implementa
// o mesmo contrato chamando comandos Rust (portable-pty, sqlite, servidor local).

export type Agente = 'claude' | 'codex' | 'gemini' | 'kiro' | 'opencode' | 'terminal';

export interface OpcoesTerminal {
  agente: Agente;
  pasta: string;
  /** Nome que aparece no cabeçalho do terminal (ex.: "Construtor"). */
  rotulo: string;
  /** Pasta isolada (git worktree) do agente, quando existe. */
  worktree?: string;
  cols?: number;
  rows?: number;
  /** Primeira tarefa: o app nativo entrega ao agente quando ele estiver pronto para receber. */
  tarefa?: string;
  /** Instrução do papel. No Claude vai como prompt de sistema. */
  instrucao?: string;
  /** Modelo do nível, com o nome que o agente entende. */
  modelo?: string;
  /** Abre o agente em modo só leitura. */
  soLeitura?: boolean;
}

/** Eventos de estado vindos dos hooks HTTP dos agentes (127.0.0.1 + token). */
export type TipoEvento =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'Notification'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Erro';

export interface EventoAgente {
  tipo: TipoEvento;
  terminalId: string;
  momento: number;
  ferramenta?: string;
  mensagem?: string;
  /** Tokens e custo (US$) acumulados desde o último evento. */
  tokens?: number;
  custo?: number;
  diff?: { mais: number; menos: number };
  subagenteId?: string;
}

export interface AgenteDetectado {
  agente: Agente;
  instalado: boolean;
  versao?: string;
  comando: string;
}

export interface UsoDoPlano {
  provedor: 'Claude' | 'Codex';
  cincoHoras: number; // 0..100
  semana: number; // 0..100
  renovaEm: string;
}

export interface SaidaGerada {
  id: string;
  tipo: 'imagem' | 'html' | 'svg';
  nome: string;
  caminho: string;
  conteudo: string; // data URL (imagem/svg) ou HTML
  terminalId?: string;
  criadoEm: number;
}

export interface ProvedorRoteador {
  id: string;
  nome: string;
  ligado: boolean;
  chamadasHoje: number;
  cotaDiaria: number;
  latenciaMs: number;
}

export interface ChamadaRoteador {
  momento: number;
  nivel: string;
  provedor: string;
  modelo: string;
  tokens: number;
  ms: number;
  ok: boolean;
}

export interface EstadoRoteador {
  endereco: string;
  ligado: boolean;
  provedores: ProvedorRoteador[];
  cadeias: Record<string, string[]>;
  chamadas: ChamadaRoteador[];
}

export type Desligar = () => void;

export interface Nativo {
  readonly modo: 'simulado' | 'tauri';

  terminais: {
    criar(opcoes: OpcoesTerminal): Promise<string>;
    escrever(id: string, dados: string): Promise<void>;
    redimensionar(id: string, cols: number, rows: number): Promise<void>;
    /** Encerra o processo de verdade (fechar o painel só esconde). */
    encerrar(id: string): Promise<void>;
    /** Tudo o que o terminal já mostrou, para redesenhar ao reabrir. */
    historico(id: string): Promise<string>;
    aoReceber(id: string, ouvinte: (dados: string) => void): Desligar;
  };

  eventos: {
    aoEvento(ouvinte: (evento: EventoAgente) => void): Desligar;
  };

  arquivos: {
    escolherPasta(): Promise<string | null>;
    ler(caminho: string): Promise<string>;
    /** Observa `.hypercube/saidas/` da sessão: imagens, .html e .svg novos. */
    observarSaidas(pasta: string, ouvinte: (saida: SaidaGerada) => void): Desligar;
  };

  processos: {
    detectarAgentes(): Promise<AgenteDetectado[]>;
    usoDoPlano(): Promise<UsoDoPlano[]>;
    criarWorktree(pasta: string, ramo: string): Promise<string>;
  };

  sistema: {
    notificar(titulo: string, corpo: string): Promise<void>;
    tocarSom(): void;
    definirTitulo(titulo: string): void;
    abrirLink(url: string): void;
    portaCanvas(): Promise<number>;
  };

  roteador: {
    estado(): Promise<EstadoRoteador>;
    ligar(ligado: boolean): Promise<void>;
    salvarCadeia(nivel: string, provedores: string[]): Promise<void>;
  };
}
