// Versão simulada do sistema: terminais falsos com agentes roteirizados,
// eventos de hook, pasta de saídas e roteador. Serve para desenhar e testar
// a interface sem o Tauri. Nada aqui toca o disco ou roda processos.
import type {
  Agente,
  AgenteDetectado,
  Desligar,
  EstadoRoteador,
  EventoAgente,
  Nativo,
  OpcoesTerminal,
  PedidoOrquestrador,
  SaidaGerada,
  UsoDoPlano,
} from './tipos';

const cor = (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`;
const AZUL = cor(147, 164, 255);
const AMBAR = cor(233, 162, 27);
const VERDE = cor(76, 195, 138);
const VERMELHO = cor(240, 100, 110);
const CINZA = cor(154, 163, 199);
const NEGRITO = '\x1b[1m';
const FIM = '\x1b[0m';

export const NOME_AGENTE: Record<Agente, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  kiro: 'Kiro',
  opencode: 'OpenCode',
  terminal: 'Terminal',
};

interface Passo {
  espera: number;
  texto?: string;
  evento?: Omit<EventoAgente, 'terminalId' | 'momento'>;
}

interface Roteiro {
  passos: Passo[];
  pergunta?: { texto: string; sim: Passo[]; nao: Passo[] };
}

const ferramenta = (nome: string, alvo: string, extra = '') =>
  `  ${AZUL}${nome.padEnd(6)}${FIM} ${alvo}${extra ? ` ${CINZA}${extra}${FIM}` : ''}\r\n`;

function montarRoteiro(agente: Agente, pedido: string): Roteiro {
  const p = pedido.toLowerCase();

  if (agente === 'terminal') {
    if (p.includes('test')) {
      return {
        passos: [
          { espera: 300, texto: `${CINZA}> vitest run --dir testes/integracao${FIM}\r\n`, evento: { tipo: 'PreToolUse', ferramenta: 'Bash' } },
          { espera: 900, texto: `${VERDE} ✓${FIM} carrinho.test.ts (12)\r\n` },
          { espera: 700, texto: `${VERMELHO} ✕${FIM} pagamento.test.ts > cobra o cartão uma vez só\r\n` },
          { espera: 300, texto: `${VERMELHO}   esperado 1 cobrança, recebido 2${FIM}\r\n\r\n` },
          { espera: 200, texto: `${VERMELHO}${NEGRITO}✕ processo saiu com código 1${FIM}\r\n`, evento: { tipo: 'Erro', mensagem: 'Teste de integração falhou (código 1)' } },
        ],
      };
    }
    return {
      passos: [{ espera: 250, texto: `${CINZA}(simulado) comando executado: ${pedido}${FIM}\r\n`, evento: { tipo: 'Stop' } }],
    };
  }

  if (/mape|procur|encontr|list|onde/.test(p)) {
    return {
      passos: [
        { espera: 400, texto: `${AZUL}◐ Mapeando o projeto…${FIM}\r\n`, evento: { tipo: 'PreToolUse', ferramenta: 'Glob', tokens: 900, custo: 0.002 } },
        { espera: 700, texto: ferramenta('Glob', 'src/**/*.ts', '48 arquivos') },
        { espera: 600, texto: ferramenta('Grep', '"cobrar("', '3 resultados'), evento: { tipo: 'PreToolUse', ferramenta: 'Grep', tokens: 1400, custo: 0.003 } },
        { espera: 700, texto: ferramenta('Read', 'src/checkout/pagamento.ts') },
        { espera: 800, texto: `\r\n${VERDE}● Pronto.${FIM} 3 pontos de cobrança: pagamento.ts:41, pedido.ts:88, webhook.ts:17.\r\n  ${CINZA}resultado.md e saida.json salvos.${FIM}\r\n`, evento: { tipo: 'Stop', tokens: 600, custo: 0.001 } },
      ],
    };
  }

  if (/revis|confer|avali/.test(p)) {
    return {
      passos: [
        { espera: 500, texto: `${AZUL}◐ Lendo o diff do Construtor (só leitura)…${FIM}\r\n`, evento: { tipo: 'PreToolUse', ferramenta: 'Read', tokens: 2100, custo: 0.01 } },
        { espera: 900, texto: ferramenta('Read', 'diff.patch', '+86 −12') },
        { espera: 900, texto: `  ${AMBAR}!${FIM} pagamento.ts:52 a nova tentativa pode cobrar duas vezes\r\n  ${AMBAR}!${FIM} falta teste para cartão recusado\r\n` },
      ],
      pergunta: {
        texto: 'Mandar 2 comentários ao Construtor?',
        sim: [
          { espera: 500, texto: ferramenta('Send', 'Construtor', '2 comentários') },
          { espera: 600, texto: `\r\n${VERDE}● Pronto.${FIM} Revisão enviada.\r\n`, evento: { tipo: 'Stop', tokens: 400, custo: 0.002 } },
        ],
        nao: [],
      },
    };
  }

  const longo = /divid|planej|orquestr/.test(p);
  const passos: Passo[] = [
    { espera: 500, texto: `${AZUL}◐ Pensando…${FIM}\r\n`, evento: { tipo: 'PreToolUse', ferramenta: 'Think', tokens: 1800, custo: 0.012 } },
    { espera: 1200, texto: ferramenta('Read', 'src/checkout/pagamento.ts'), evento: { tipo: 'PreToolUse', ferramenta: 'Read', tokens: 2400, custo: 0.015 } },
    { espera: 1100, texto: ferramenta('Read', 'src/checkout/pedido.ts') },
  ];
  if (longo) {
    passos.push(
      { espera: 1400, texto: `${AZUL}◐ Dividindo em 3 tarefas…${FIM}\r\n`, evento: { tipo: 'PreToolUse', ferramenta: 'Plan', tokens: 3200, custo: 0.03 } },
      { espera: 1300, texto: ferramenta('Task', 'Explorador', 'mapear pontos de cobrança'), evento: { tipo: 'SubagentStart', mensagem: 'Mapear pontos de cobrança', subagenteId: 'sub-1' } },
      { espera: 1500, texto: ferramenta('Task', 'Construtor', 'nova tentativa sem cobrança dupla') },
      { espera: 1500, texto: ferramenta('Task', 'Revisor', 'revisão cruzada do diff') },
      { espera: 6000, texto: `  ${CINZA}esperando os agentes entregarem resultado.md…${FIM}\r\n`, evento: { tipo: 'SubagentStop', subagenteId: 'sub-1', tokens: 900, custo: 0.004 } },
      { espera: 9000, texto: ferramenta('Read', 'vertices/batedor/resultado.md') },
      { espera: 12000, texto: ferramenta('Read', 'vertices/construtor/diff.patch', '+86 −12'), evento: { tipo: 'PreToolUse', ferramenta: 'Read', tokens: 2600, custo: 0.02 } },
      { espera: 14000, texto: `  ${CINZA}esperando a revisão…${FIM}\r\n` },
      { espera: 20000, texto: ferramenta('Read', 'vertices/revisor/resultado.md') },
    );
  } else {
    passos.push(
      { espera: 1300, texto: ferramenta('Task', 'subagente', 'ler testes existentes'), evento: { tipo: 'SubagentStart', mensagem: 'Ler testes existentes', subagenteId: 'sub-1' } },
      { espera: 1800, texto: ferramenta('Edit', 'src/checkout/pagamento.ts', '+18 −4'), evento: { tipo: 'PreToolUse', ferramenta: 'Edit', tokens: 3100, custo: 0.024, diff: { mais: 18, menos: 4 } } },
      { espera: 1600, texto: ferramenta('Edit', 'src/checkout/tentativa.ts', '+41 −0'), evento: { tipo: 'SubagentStop', subagenteId: 'sub-1', diff: { mais: 41, menos: 0 } } },
      { espera: 1700, texto: ferramenta('Write', 'testes/tentativa.test.ts', '+27 −8'), evento: { tipo: 'PreToolUse', ferramenta: 'Write', tokens: 2700, custo: 0.02, diff: { mais: 27, menos: 8 } } },
    );
  }
  return {
    passos,
    pergunta: {
      texto: 'Rodar `npm test`?',
      sim: [
        { espera: 400, texto: ferramenta('Bash', 'npm test'), evento: { tipo: 'PreToolUse', ferramenta: 'Bash', tokens: 500, custo: 0.004 } },
        { espera: 1500, texto: `  ${VERDE}✓${FIM} 24 testes passaram\r\n` },
        { espera: 600, texto: `\r\n${VERDE}● Pronto.${FIM} resultado.md, saida.json e diff.patch salvos.\r\n`, evento: { tipo: 'Stop', tokens: 700, custo: 0.005 } },
      ],
      nao: [],
    },
  };
}

class TerminalSimulado {
  historico = '';
  linha = '';
  ocupado = false;
  aguardando: Roteiro['pergunta'] | null = null;
  ouvintes = new Set<(d: string) => void>();
  timers: number[] = [];
  vivo = true;

  constructor(
    readonly id: string,
    readonly opcoes: OpcoesTerminal,
    private readonly emitir: (e: Omit<EventoAgente, 'momento'>) => void,
    /** Líder: recebe a tarefa também por aqui, para usar as ferramentas do Hypercube. */
    private readonly aoTarefa?: (texto: string) => void,
  ) {
    const nome = NOME_AGENTE[opcoes.agente];
    const local = opcoes.worktree ? opcoes.worktree.replace(opcoes.pasta, '.') : opcoes.pasta;
    if (opcoes.agente === 'terminal') {
      this.saida(`${CINZA}${local}${FIM}\r\n`);
    } else {
      this.saida(`${AZUL}${NEGRITO}◇ ${nome}${FIM}  ${CINZA}${opcoes.rotulo} · ${local}${FIM}\r\n`);
      this.saida(`${CINZA}  hooks ligados em 127.0.0.1 · digite uma tarefa e Enter${FIM}\r\n\r\n`);
    }
    this.prompt();
    this.agendar(50, () => this.emitir({ tipo: 'SessionStart', terminalId: id }));
  }

  /** Linha escrita por fora do roteiro (ex.: ferramenta do Hypercube chamada pelo Líder). */
  anotar(t: string) {
    this.saida(t);
  }

  private saida(t: string) {
    this.historico += t;
    if (this.historico.length > 200_000) this.historico = this.historico.slice(-150_000);
    this.ouvintes.forEach((o) => o(t));
  }

  private prompt() {
    this.saida(this.opcoes.agente === 'terminal' ? `${VERDE}$${FIM} ` : `${AZUL}›${FIM} `);
  }

  private agendar(ms: number, f: () => void) {
    this.timers.push(window.setTimeout(() => this.vivo && f(), ms));
  }

  escrever(dados: string) {
    for (const ch of dados) {
      if (this.aguardando) {
        const k = ch.toLowerCase();
        if (k === 's' || k === 'y' || k === 'n') this.responder(k !== 'n');
        continue;
      }
      if (this.ocupado) {
        if (ch === '\x1b') this.interromper();
        continue;
      }
      if (ch === '\r' || ch === '\n') {
        this.saida('\r\n');
        const texto = this.linha.trim();
        this.linha = '';
        if (texto) this.executar(texto);
        else this.prompt();
      } else if (ch === '\x7f' || ch === '\b') {
        if (this.linha.length) {
          this.linha = this.linha.slice(0, -1);
          this.saida('\b \b');
        }
      } else if (ch >= ' ') {
        this.linha += ch;
        this.saida(ch);
      }
    }
  }

  private interromper() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.ocupado = false;
    this.saida(`\r\n${AMBAR}◆ Interrompido. Diga o que fazer agora.${FIM}\r\n`);
    this.emitir({ tipo: 'Stop', terminalId: this.id, mensagem: 'Interrompido' });
    this.prompt();
  }

  private executar(texto: string) {
    this.ocupado = true;
    this.emitir({ tipo: 'UserPromptSubmit', terminalId: this.id, mensagem: texto });
    this.aoTarefa?.(texto);
    const roteiro = montarRoteiro(this.opcoes.agente, texto);
    this.rodar(roteiro.passos, () => {
      if (roteiro.pergunta) {
        this.aguardando = roteiro.pergunta;
        this.saida(`\r\n${AMBAR}${NEGRITO}◆ Permissão:${FIM} ${roteiro.pergunta.texto} ${CINZA}[s/n]${FIM} `);
        this.emitir({ tipo: 'Notification', terminalId: this.id, mensagem: roteiro.pergunta.texto });
      } else {
        this.ocupado = false;
        this.prompt();
      }
    });
  }

  private responder(sim: boolean) {
    const pergunta = this.aguardando!;
    this.aguardando = null;
    this.saida(sim ? `${VERDE}s${FIM}\r\n` : `${VERMELHO}n${FIM}\r\n`);
    this.emitir({ tipo: 'UserPromptSubmit', terminalId: this.id, mensagem: sim ? 'Permitido' : 'Negado' });
    const passos = sim
      ? pergunta.sim
      : [{ espera: 300, texto: `${VERMELHO}✕ Negado.${FIM} O agente parou e espera outra instrução.\r\n`, evento: { tipo: 'Stop' as const } }];
    this.rodar(passos, () => {
      this.ocupado = false;
      this.prompt();
    });
  }

  private rodar(passos: Passo[], fim: () => void) {
    let t = 0;
    passos.forEach((p) => {
      t += p.espera;
      this.agendar(t, () => {
        if (p.texto) this.saida(p.texto);
        if (p.evento) this.emitir({ ...p.evento, terminalId: this.id });
      });
    });
    this.agendar(t + 60, fim);
  }

  encerrar() {
    this.saida(`\r\n${CINZA}[processo encerrado]${FIM}\r\n`);
    this.vivo = false;
    this.timers.forEach((t) => clearTimeout(t));
  }
}

// ---------- imagens de exemplo para a pasta de saídas ----------

function telaSvg(titulo: string, destaque: string, variante: number): string {
  const linhas = [0, 1, 2]
    .map((i) => `<rect x="40" y="${150 + i * 54}" width="${260 - i * 40 - variante * 10}" height="34" rx="8" fill="#E6E9F5"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="340" viewBox="0 0 480 340">
<rect width="480" height="340" rx="14" fill="#FFFFFF"/>
<rect width="480" height="52" rx="14" fill="${destaque}"/><rect y="38" width="480" height="14" fill="${destaque}"/>
<circle cx="30" cy="26" r="9" fill="#FFFFFF" opacity=".85"/>
<text x="50" y="31" font-family="sans-serif" font-size="15" fill="#FFFFFF" font-weight="600">${titulo}</text>
<text x="40" y="112" font-family="sans-serif" font-size="22" fill="#142057" font-weight="700">Pagamento</text>
${linhas}
<rect x="330" y="150" width="112" height="${variante === 2 ? 142 : 88}" rx="10" fill="#F2F4FB" stroke="#D5DAEE"/>
<rect x="40" y="${variante === 1 ? 284 : 296}" width="${variante === 1 ? 400 : 180}" height="36" rx="9" fill="${destaque}"/>
<text x="${variante === 1 ? 210 : 82}" y="${variante === 1 ? 307 : 319}" font-family="sans-serif" font-size="14" fill="#FFF" font-weight="600">Pagar agora</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function pinturaSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2238C4"/><stop offset="1" stop-color="#E9A21B"/></linearGradient></defs>
<rect width="360" height="360" rx="18" fill="url(#g)"/>
<circle cx="250" cy="110" r="54" fill="#FFFFFF" opacity=".25"/>
<path d="M0 270 L110 170 L190 240 L260 190 L360 270 L360 360 L0 360Z" fill="#0B132D" opacity=".7"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const HTML_CARTAO = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
body{margin:0;font-family:system-ui,sans-serif;background:#F7F4EC;color:#142057;display:grid;place-items:center;height:100vh}
.c{background:#fff;border-radius:14px;padding:22px 24px;box-shadow:0 6px 24px #14205722;width:240px}
h2{margin:0 0 6px;font-size:18px}p{margin:0 0 14px;font-size:13px;color:#46547E}
button{border:0;border-radius:8px;background:#2238C4;color:#fff;padding:10px 14px;font-weight:600;width:100%}
</style></head><body><div class="c"><h2>Resumo do pedido</h2><p>3 itens · frete grátis</p><p><b>Total R$ 189,90</b></p><button>Finalizar compra</button></div></body></html>`;

// ---------- implementação ----------

let contador = 0;
const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}-${(contador++).toString(36)}`;

export function criarNativoSimulado(): Nativo {
  const terminais = new Map<string, TerminalSimulado>();
  const ouvintesEvento = new Set<(e: EventoAgente) => void>();
  const ouvintesFim = new Set<(f: { id: string; codigo: number }) => void>();
  /** Agentes "instalados" pelo botão Instalar nesta abertura. */
  const instaladosAqui = new Set<string>();
  /** Finge a instalação: mostra o npm trabalhando, marca o agente como instalado e termina com 0. */
  const fingirInstalacao = (id: string, agente: string, linha: string) => {
    const t = terminais.get(id);
    const pacote = /npm install -g (\S+)/.exec(linha)?.[1] ?? agente;
    const passos: [number, string][] = [
      [400, `${CINZA}PS> npm install -g ${pacote}${FIM}\r\n`],
      [1200, `${CINZA}added 1 package in 2s${FIM}\r\n`],
      [400, `${VERDE}✓ ${pacote} instalado${FIM}\r\n`],
    ];
    let ms = 0;
    for (const [espera, texto] of passos) {
      ms += espera;
      window.setTimeout(() => t?.anotar(texto), ms);
    }
    window.setTimeout(() => {
      instaladosAqui.add(agente);
      ouvintesFim.forEach((o) => o({ id, codigo: 0 }));
    }, ms + 300);
  };
  const emitir = (e: Omit<EventoAgente, 'momento'>) => {
    const evento = { ...e, momento: Date.now() };
    ouvintesEvento.forEach((o) => o(evento));
  };

  // Ferramentas do Hypercube no simulado: o Líder roteirizado chama a interface como o de verdade.
  const ouvintesPedido = new Set<(p: PedidoOrquestrador) => void>();
  const pendentes = new Map<number, (texto: string) => void>();
  let proximoPedido = 1;
  const pedir = (terminalId: string, ferramenta: string, argumentos: Record<string, unknown>) =>
    new Promise<string>((resolve) => {
      const pedido = proximoPedido++;
      pendentes.set(pedido, (texto) => {
        terminais.get(terminalId)?.anotar(`  ${AZUL}hypercube${FIM} ${ferramenta} ${CINZA}→ ${texto.split('\n')[0]}${FIM}\r\n`);
        resolve(texto);
      });
      ouvintesPedido.forEach((o) => o({ pedido, terminalId, ferramenta, argumentos }));
    });
  const pausa = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
  /** Roteiro do Líder: monta a lista, chama Explorador e Construtor e deixa uma pergunta no item 3. */
  async function roteiroLider(id: string, texto: string) {
    const pedido = texto.replace(/^.*?:\s*/, '').slice(0, 60) || 'o pedido';
    const lista = (estados: string[], extra: Record<number, Record<string, string>> = {}) => ({
      itens: [
        { n: 1, titulo: `Mapear onde mexer para: ${pedido}`, estado: estados[0], quem: 'Explorador' },
        { n: 2, titulo: 'Fazer a mudança com testes', estado: estados[1], quem: 'Construtor' },
        { n: 3, titulo: 'Revisar a branch e abrir o pull request', estado: estados[2], quem: 'Revisor' },
      ].map((i) => ({ ...i, ...(extra[i.n] ?? {}) })),
    });
    await pausa(1200);
    await pedir(id, 'atualizar_lista', lista(['aberto', 'aberto', 'aberto']));
    await pausa(1500);
    await pedir(id, 'criar_agente', { papel: 'batedor', agente: 'gemini', nivel: 'barato', tarefa: `Mapeie onde mexer para: ${pedido}. Entregue no formato do seu papel.` });
    await pedir(id, 'atualizar_lista', lista(['em_andamento', 'aberto', 'aberto']));
    await pausa(3500);
    await pedir(id, 'criar_agente', { papel: 'construtor', agente: 'codex', nivel: 'padrao', tarefa: `Faça a mudança: ${pedido}. Entregue no formato do seu papel.` });
    await pedir(id, 'atualizar_lista', lista(['fechado', 'em_andamento', 'pergunta'], { 3: { pergunta: 'Abro o pull request quando a revisão passar, ou só deixo a branch pronta?' } }));
  }

  const roteador: EstadoRoteador = {
    endereco: '127.0.0.1:8765',
    ligado: true,
    provedores: [
      { id: 'groq', nome: 'Groq', ligado: true, chamadasHoje: 142, cotaDiaria: 1000, latenciaMs: 380 },
      { id: 'gemini', nome: 'Gemini', ligado: true, chamadasHoje: 61, cotaDiaria: 250, latenciaMs: 910 },
      { id: 'kiro', nome: 'Kiro grátis', ligado: false, chamadasHoje: 0, cotaDiaria: 50, latenciaMs: 0 },
    ],
    cadeias: { barato: ['groq', 'gemini', 'kiro'], padrao: ['gemini', 'groq'] },
    chamadas: Array.from({ length: 9 }, (_, i) => ({
      momento: Date.now() - i * 1000 * 60 * (3 + i),
      nivel: i % 3 === 0 ? 'padrao' : 'barato',
      provedor: i % 4 === 1 ? 'Gemini' : 'Groq',
      modelo: i % 4 === 1 ? 'gemini-flash' : 'llama-instant',
      tokens: 600 + ((i * 397) % 2400),
      ms: 280 + ((i * 131) % 900),
      ok: i !== 5,
    })),
  };

  return {
    modo: 'simulado',
    terminais: {
      async criar(opcoes) {
        const id = novoId('pty');
        // Só o pedido do modo Equipe dispara o roteiro com as ferramentas (o exemplo já tem a equipe pronta).
        const lider = opcoes.orquestrar ? (texto: string) => texto.startsWith('Divida esta tarefa') && roteiroLider(id, texto) : undefined;
        terminais.set(id, new TerminalSimulado(id, opcoes, emitir, lider));
        const instalar = /^Instalar (\w+)$/.exec(opcoes.rotulo);
        if (opcoes.agente === 'terminal' && instalar && opcoes.tarefa) fingirInstalacao(id, instalar[1], opcoes.tarefa);
        return id;
      },
      async escrever(id, dados) {
        terminais.get(id)?.escrever(dados);
      },
      async enviar(id, texto) {
        terminais.get(id)?.escrever(`${texto}\r`);
      },
      async ocioso(id) {
        return terminais.has(id) ? 10_000 : null;
      },
      async resultado(id) {
        return (terminais.get(id)?.historico ?? '').slice(-2000);
      },
      async redimensionar() {},
      async encerrar(id) {
        terminais.get(id)?.encerrar();
        terminais.delete(id);
      },
      async historico(id) {
        return terminais.get(id)?.historico ?? '';
      },
      aoReceber(id, ouvinte): Desligar {
        const t = terminais.get(id);
        if (!t) return () => {};
        t.ouvintes.add(ouvinte);
        return () => t.ouvintes.delete(ouvinte);
      },
    },
    eventos: {
      aoEvento(ouvinte) {
        ouvintesEvento.add(ouvinte);
        return () => ouvintesEvento.delete(ouvinte);
      },
      aoFim(ouvinte) {
        ouvintesFim.add(ouvinte);
        return () => ouvintesFim.delete(ouvinte);
      },
    },
    orquestrador: {
      aoPedido(ouvinte) {
        ouvintesPedido.add(ouvinte);
        return () => ouvintesPedido.delete(ouvinte);
      },
      async responder(pedido, texto, erro) {
        pendentes.get(pedido)?.(erro ? `erro: ${texto}` : texto);
        pendentes.delete(pedido);
      },
    },
    arquivos: {
      async escolherPasta() {
        return 'C:\\Projetos\\novo-projeto';
      },
      async ler(caminho) {
        if (caminho.endsWith('resultado.md')) return '# Resultado\n\n- Tarefa concluída.\n- 3 arquivos alterados.\n- 24 testes passaram.\n';
        if (caminho.endsWith('saida.json')) return '{\n  "ok": true,\n  "arquivos": 3,\n  "testes": { "passaram": 24, "falharam": 0 }\n}\n';
        if (caminho.endsWith('diff.patch'))
          return '--- a/src/checkout/pagamento.ts\n+++ b/src/checkout/pagamento.ts\n@@ -41,7 +41,12 @@\n-  await cobrar(pedido)\n+  if (!pedido.cobrado) {\n+    await cobrar(pedido)\n+    pedido.cobrado = true\n+  }\n';
        return '';
      },
      observarSaidas(pasta, ouvinte) {
        const base = `${pasta}\\.hypercube\\saidas`;
        const agora = Date.now();
        const existentes: SaidaGerada[] = [
          { id: 's1', tipo: 'svg', nome: 'checkout-v1.svg', caminho: `${base}\\checkout-v1.svg`, conteudo: telaSvg('Loja · Checkout v1', '#2238C4', 0), criadoEm: agora - 600_000 },
          { id: 's2', tipo: 'svg', nome: 'checkout-v2.svg', caminho: `${base}\\checkout-v2.svg`, conteudo: telaSvg('Loja · Checkout v2', '#1A2C9E', 1), criadoEm: agora - 300_000 },
          { id: 's3', tipo: 'html', nome: 'resumo-pedido.html', caminho: `${base}\\resumo-pedido.html`, conteudo: HTML_CARTAO, criadoEm: agora - 200_000 },
          { id: 's4', tipo: 'imagem', nome: 'capa-promocao.png', caminho: `${base}\\capa-promocao.png`, conteudo: pinturaSvg(), criadoEm: agora - 100_000 },
        ];
        const timers = existentes.map((s, i) => window.setTimeout(() => ouvinte(s), 20 * i));
        timers.push(
          window.setTimeout(
            () =>
              ouvinte({ id: 's5', tipo: 'svg', nome: 'checkout-v3.svg', caminho: `${base}\\checkout-v3.svg`, conteudo: telaSvg('Loja · Checkout v3', '#2238C4', 2), criadoEm: Date.now() }),
            9000,
          ),
        );
        return () => timers.forEach((t) => clearTimeout(t));
      },
    },
    processos: {
      async detectarAgentes(): Promise<AgenteDetectado[]> {
        return [
          { agente: 'claude', instalado: true, versao: '2.1', comando: 'claude' },
          { agente: 'codex', instalado: true, versao: '0.9', comando: 'codex' },
          { agente: 'gemini', instalado: true, versao: '1.4', comando: 'gemini' },
          { agente: 'kiro', instalado: instaladosAqui.has('kiro'), comando: 'kiro' },
          { agente: 'opencode', instalado: instaladosAqui.has('opencode'), versao: instaladosAqui.has('opencode') ? '1.0' : undefined, comando: 'opencode' },
          { agente: 'terminal', instalado: true, comando: 'pwsh' },
        ];
      },
      async usoDoPlano(): Promise<UsoDoPlano[]> {
        return [
          { provedor: 'Claude', cincoHoras: 42, semana: 18, renovaEm: '2 h 10 min' },
          { provedor: 'Codex', cincoHoras: 11, semana: 6, renovaEm: '4 h 02 min' },
        ];
      },
      async resumoMudancas(worktree) {
        return `Pasta: ${worktree}\nBranch: v/simulado\nCommits novos:\n(nenhum)`;
      },
      async criarWorktree(pasta, ramo) {
        return `${pasta}\\.hypercube\\worktrees\\${ramo}`;
      },
    },
    sistema: {
      async notificar(titulo, corpo) {
        // No Tauri vira notificação do Windows; aqui só registra.
        console.info(`[notificação] ${titulo}: ${corpo}`);
      },
      tocarSom() {
        try {
          const ctx = new AudioContext();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.04, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
          o.connect(g).connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.26);
        } catch {
          /* sem áudio */
        }
      },
      definirTitulo(titulo) {
        document.title = titulo;
      },
      async abrirPasta(caminho) {
        console.info('[simulado] abrir pasta', caminho);
      },
      abrirLink(url) {
        window.open(url, '_blank', 'noopener');
      },
      async portaCanvas() {
        return 48213;
      },
    },
    roteador: {
      async estado() {
        return structuredClone(roteador);
      },
      async ligar(ligado) {
        roteador.ligado = ligado;
      },
      async salvarCadeia(nivel, provedores) {
        roteador.cadeias[nivel] = provedores;
      },
    },
  };
}
