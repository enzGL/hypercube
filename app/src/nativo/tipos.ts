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
  /** Esforço de raciocínio pelo nível (Codex). */
  esforco?: 'low' | 'medium' | 'high';
  /** Líder: ganha as ferramentas do Hypercube para criar e chamar outros agentes. */
  orquestrar?: boolean;
}

/** Pedido do Líder (ferramenta do Hypercube) que a interface atende. */
export interface PedidoOrquestrador {
  pedido: number;
  terminalId: string;
  ferramenta: string;
  argumentos: Record<string, unknown>;
}

export interface FimTerminal {
  id: string;
  codigo: number;
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
  /** Por que não está pronto (falta chave, CLI não instalada…). */
  nota?: string;
  pausaSegundos?: number;
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
    /** Manda uma mensagem: o texto e, um instante depois, o Enter. */
    enviar(id: string, texto: string): Promise<void>;
    /** Última resposta do agente (ou o fim da tela do terminal). */
    resultado(id: string): Promise<string>;
    /** Há quanto tempo (ms) o terminal não mostra nada; null se ele não existe mais. */
    ocioso(id: string): Promise<number | null>;
    redimensionar(id: string, cols: number, rows: number): Promise<void>;
    /** Encerra o processo de verdade (fechar o painel só esconde). */
    encerrar(id: string): Promise<void>;
    /** Tudo o que o terminal já mostrou, para redesenhar ao reabrir. */
    historico(id: string): Promise<string>;
    aoReceber(id: string, ouvinte: (dados: string) => void): Desligar;
  };

  eventos: {
    aoEvento(ouvinte: (evento: EventoAgente) => void): Desligar;
    /** O processo do terminal terminou. */
    aoFim(ouvinte: (fim: FimTerminal) => void): Desligar;
  };

  orquestrador: {
    aoPedido(ouvinte: (p: PedidoOrquestrador) => void): Desligar;
    responder(pedido: number, texto: string, erro?: boolean): Promise<void>;
  };

  arquivos: {
    escolherPasta(): Promise<string | null>;
    ler(caminho: string): Promise<string>;
    /** Observa `.hypercube/saidas/` da sessão: imagens, .html e .svg novos. */
    observarSaidas(pasta: string, ouvinte: (saida: SaidaGerada) => void): Desligar;
    /** Grava html/svg (`texto`) ou copia uma imagem (`copiarDe`) para `.hypercube/saidas/` da sessão. Devolve o caminho. */
    salvarSaida(pasta: string, nome: string, conteudo: { texto?: string; copiarDe?: string }): Promise<string>;
  };

  processos: {
    /** `novo`: procura de novo em vez de usar a última procura (depois de instalar um agente). */
    detectarAgentes(novo?: boolean): Promise<AgenteDetectado[]>;
    usoDoPlano(): Promise<UsoDoPlano[]>;
    criarWorktree(pasta: string, ramo: string): Promise<string>;
    /** Branch, commits e diff da cópia (worktree) de um agente. */
    resumoMudancas(worktree: string, pasta: string): Promise<string>;
  };

  sistema: {
    notificar(titulo: string, corpo: string): Promise<void>;
    tocarSom(): void;
    definirTitulo(titulo: string): void;
    abrirLink(url: string): void;
    /** Abre a pasta no explorador de arquivos do sistema. */
    abrirPasta(caminho: string): Promise<void>;
    portaCanvas(): Promise<number>;
  };

  roteador: {
    estado(): Promise<EstadoRoteador>;
    ligar(ligado: boolean): Promise<void>;
    salvarCadeia(nivel: string, provedores: string[]): Promise<void>;
    /** Pedido de texto a um nível ("barato", "padrao", "forte"); erra se o roteador está desligado. */
    consultar(nivel: string, pedido: string): Promise<string>;
  };
}
