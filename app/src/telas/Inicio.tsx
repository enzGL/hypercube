// Início: saudação, caixa de comando, projetos recentes, atalhos e uso dos agentes.
import { LogoAgente } from '../componentes/LogoAgente';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  abrirDialogo,
  atividade90Dias,
  avisar,
  criarSessao,
  criarVertice,
  lerEstado,
  nomeUsuario,
  selecionarSessao,
  useLoja,
  type Estado,
} from '../estado/loja';
import { nativo, NOME_AGENTE, type Agente, type AgenteDetectado, type UsoDoPlano } from '../nativo';
import { FundoDither } from '../componentes/FundoDither';
import { Icone } from '../componentes/Pecas';
import '../inicio.css';

type Modo = 'normal' | 'planejar' | 'equipe';
const NOME_MODO: Record<Modo, string> = { normal: 'Normal', planejar: 'Planejar', equipe: 'Equipe' };
const DICA_MODO: Record<Modo, string> = {
  normal: 'Normal: um agente faz a tarefa.',
  planejar: 'Planejar: o agente só monta o plano, sem mudar arquivos.',
  equipe: 'Equipe: um líder divide a tarefa com um explorador, um construtor e um revisor.',
};
const AGENTES_PADRAO: Agente[] = ['claude', 'codex', 'gemini'];

// ---------- utilidades ----------

function saudacao(h: number) {
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function dataCurta(d: Date) {
  const dia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(d)
    .replace(/\./g, '');
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
  return `${dia} · ${hora}`;
}

function haQuanto(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  const d = new Date(ms);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(d).replace(/\./g, '');
}

const nomePasta = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;
const pastaCurta = (p: string) => p.replace(/^C:\\Users\\[^\\]+/i, '~');

function corDoNome(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cores = ['#2238C4', '#2E9C8F', '#C27A12', '#8A5BD6', '#C2475A', '#4B5A93'];
  return cores[h % cores.length];
}

interface Projeto {
  pasta: string;
  nome: string;
  terminais: number;
  quando: number;
  sessaoId: string;
}

function projetosRecentes(e: Estado): Projeto[] {
  const porPasta = new Map<string, Projeto>();
  for (const s of e.sessoes) {
    const vs = e.vertices.filter((v) => v.sessaoId === s.id && !v.paiId);
    const quando = Math.max(0, ...vs.map((v) => v.atualizadoEm));
    const p = porPasta.get(s.pasta);
    if (!p) porPasta.set(s.pasta, { pasta: s.pasta, nome: nomePasta(s.pasta), terminais: vs.length, quando, sessaoId: s.id });
    else {
      p.terminais += vs.length;
      if (quando > p.quando) {
        p.quando = quando;
        p.sessaoId = s.id;
      }
    }
  }
  return [...porPasta.values()].sort((a, b) => b.quando - a.quando);
}

// ---------- ações dos atalhos ----------

function pastaAtual(): string | null {
  const e = lerEstado();
  return e.sessoes.find((s) => s.id === e.sessaoAtivaId)?.pasta ?? e.sessoes[0]?.pasta ?? null;
}

async function novoTerminal() {
  const e = lerEstado();
  let s = e.sessoes.find((x) => x.id === e.sessaoAtivaId) ?? e.sessoes[0];
  if (!s) {
    const pasta = await nativo.arquivos.escolherPasta();
    if (!pasta) return;
    s = criarSessao(nomePasta(pasta), pasta, false);
  }
  selecionarSessao(s.id);
  await criarVertice(s.id, 'agente', 'terminal', 'barato', undefined, { nome: 'Terminal' });
}

function novoProjeto() {
  abrirDialogo({ tipo: 'novaSessao' });
}

function novoGrupo() {
  const pasta = pastaAtual();
  if (!pasta) return novoProjeto();
  const n = lerEstado().sessoes.filter((s) => s.pasta === pasta).length + 1;
  criarSessao(`Grupo ${n}`, pasta, true);
  avisar(`Grupo ${n} criado em ${nomePasta(pasta)}.`);
}

// ---------- ícones locais ----------

function Ic({ d, tamanho = 15 }: { d: string; tamanho?: number }) {
  return (
    <svg className="icone" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const IC_TERMINAL = 'M4 5h16v14H4zM8 10l2.5 2L8 14M13 14h3';
const IC_PROJETO = 'M3 7h6l2 2h10v10H3zM12 12v5M9.5 14.5h5';
const IC_GRUPO = 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5';
const IC_ATUALIZAR = 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6';
const IC_RELOGIO = 'M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z';
const IC_ATIVIDADE = 'M3 17l5-6 4 3 4-6 5 5';
const IC_DESCER = 'M7 10l5 5 5-5';

// ---------- peças ----------

function useRelogio() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  return agora;
}

function Seletor<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  icone,
  largo = false,
}: {
  rotulo: string;
  valor: T;
  opcoes: { valor: T; nome: string }[];
  aoMudar: (v: T) => void;
  icone: React.ReactNode;
  largo?: boolean;
}) {
  return (
    <label className={`ini-seletor${largo ? ' largo' : ''}`}>
      {icone}
      <span className="ini-seletor-rotulo">{rotulo}:</span>
      <select value={valor} onChange={(ev) => aoMudar(ev.target.value as T)} aria-label={rotulo}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nome}
          </option>
        ))}
      </select>
      <Ic d={IC_DESCER} tamanho={13} />
    </label>
  );
}

function CaixaComando({ pastas }: { pastas: string[] }) {
  const [texto, setTexto] = useState('');
  const [agentes, setAgentes] = useState<AgenteDetectado[]>([]);
  const [agente, setAgente] = useState<Agente>('claude');
  const [pasta, setPasta] = useState<string>(() => pastaAtual() ?? pastas[0] ?? '');
  const [extras, setExtras] = useState<string[]>([]);
  const [modo, setModo] = useState<Modo>('normal');
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nativo.processos.detectarAgentes().then(setAgentes);
  }, []);
  useEffect(() => {
    if (!pasta && pastas[0]) setPasta(pastas[0]);
  }, [pastas, pasta]);

  const instalados = agentes.filter((a) => a.instalado && a.agente !== 'terminal').map((a) => a.agente);
  const listaAgentes = instalados.length ? instalados : AGENTES_PADRAO;
  const listaPastas = [...new Set([...pastas, ...extras, ...(pasta ? [pasta] : [])])];

  const escolherPasta = async (v: string) => {
    if (v !== '__outra') return setPasta(v);
    const p = await nativo.arquivos.escolherPasta();
    if (p) {
      setExtras((x) => [...x, p]);
      setPasta(p);
    }
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    if (!pasta) {
      avisar('Escolha uma pasta para o projeto primeiro.');
      return;
    }
    setEnviando(true);
    try {
      const nome = t.length > 38 ? `${t.slice(0, 36).trimEnd()}…` : t;
      const s = criarSessao(nome, pasta, modo === 'equipe', modo === 'equipe');
      if (modo === 'equipe') {
        await criarVertice(s.id, 'lider', agente, 'forte', `Divida esta tarefa entre os agentes: ${t}`);
        // Só com os agentes instalados: sem Gemini ou Codex, o papel fica com o agente escolhido.
        const tem = (a: Agente) => listaAgentes.includes(a);
        await criarVertice(s.id, 'batedor', tem('gemini') ? 'gemini' : agente, 'barato');
        await criarVertice(s.id, 'construtor', tem('codex') ? 'codex' : agente, 'padrao');
        await criarVertice(s.id, 'revisor', agente, 'padrao');
      } else {
        await criarVertice(s.id, 'agente', agente, 'padrao', modo === 'planejar' ? `Só planeje, sem mudar arquivos: ${t}` : t);
      }
      setTexto('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ini-comando" onClick={(ev) => ev.target === ev.currentTarget && campo.current?.focus()}>
      <div className="ini-comando-barra">
        <span className="ini-luz" style={{ background: 'var(--erro)' }} />
        <span className="ini-luz" style={{ background: 'var(--esperando)' }} />
        <span className="ini-luz" style={{ background: 'var(--pronto)' }} />
        <span className="ini-comando-titulo mono">hypercube@{pasta ? nomePasta(pasta) : 'cubo'}:~</span>
      </div>
      <div className="ini-comando-linha">
        <span className="ini-prompt mono" aria-hidden="true">❯</span>
        <input
          ref={campo}
          className="ini-comando-campo mono"
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
              ev.preventDefault();
              enviar();
            }
          }}
          placeholder="O que você quer construir?"
          aria-label="O que você quer construir?"
          spellCheck={false}
        />
      </div>
      <div className="ini-comando-opcoes">
        <Seletor
          rotulo="Agente"
          valor={agente}
          aoMudar={setAgente}
          icone={<LogoAgente agente={agente} tamanho={14} />}
          opcoes={listaAgentes.map((a) => ({ valor: a, nome: NOME_AGENTE[a] }))}
        />
        <Seletor
          rotulo="Pasta"
          valor={pasta || '__outra'}
          aoMudar={escolherPasta}
          largo
          icone={<Icone nome="pasta" tamanho={14} />}
          opcoes={[...listaPastas.map((p) => ({ valor: p, nome: pastaCurta(p) })), { valor: '__outra', nome: 'Escolher outra pasta…' }]}
        />
        <Seletor
          rotulo="Modo"
          valor={modo}
          aoMudar={setModo}
          icone={<span className="ini-ponto-agente" style={{ background: 'var(--cobalto-claro)' }} />}
          opcoes={(Object.keys(NOME_MODO) as Modo[]).map((m) => ({ valor: m, nome: NOME_MODO[m] }))}
        />
        <button className="ini-enviar" onClick={enviar} disabled={!texto.trim() || enviando} aria-label="Enviar (Enter)" title="Enviar (Enter)">
          <Icone nome="enviar" tamanho={16} />
        </button>
      </div>
      <p className="ini-dica-modo">{DICA_MODO[modo]}</p>
    </div>
  );
}

function CartaoUso({ uso, aoAtualizar }: { uso: UsoDoPlano; aoAtualizar: () => void }) {
  const agente: Agente = uso.provedor === 'Claude' ? 'claude' : 'codex';
  const alto = uso.cincoHoras >= 80;
  return (
    <article className="ini-uso">
      <header className="ini-uso-topo">
        <span className="ini-uso-avatar">
          <LogoAgente agente={agente} tamanho={18} />
        </span>
        <b className="ini-uso-nome">{NOME_AGENTE[agente]}</b>
        <span className="ini-vivo">
          <span className="ini-vivo-ponto" /> ao vivo
        </span>
        <button className="icone-botao" onClick={aoAtualizar} aria-label={`Atualizar uso do ${uso.provedor}`} title="Atualizar">
          <Ic d={IC_ATUALIZAR} tamanho={14} />
        </button>
      </header>
      <div className="ini-uso-numero">
        <span className={`mono ini-grande${alto ? ' alto' : ''}`}>{uso.cincoHoras}</span>
        <span className="ini-unidade">%</span>
        <span className="ini-reset mono" title="Tempo até o limite de 5 horas renovar">
          <Ic d={IC_RELOGIO} tamanho={12} /> {uso.renovaEm}
        </span>
      </div>
      <div className="ini-barra" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uso.cincoHoras} aria-label="Uso nas últimas 5 horas">
        <span style={{ width: `${Math.min(100, uso.cincoHoras)}%` }} className={alto ? 'alto' : ''} />
      </div>
      <p className="ini-uso-rodape">
        <span>
          janela de 5 h · semana <span className="mono">{uso.semana}%</span>
        </span>
      </p>
    </article>
  );
}

function CartaoAtividade({ dias, aoAtualizar }: { dias: number[]; aoAtualizar: () => void }) {
  const total = dias.reduce((a, b) => a + b, 0);
  const ultimos = dias.slice(-30).reduce((a, b) => a + b, 0);
  const antes = dias.slice(-60, -30).reduce((a, b) => a + b, 0) || 1;
  const variacao = Math.round(((ultimos - antes) / antes) * 100);
  const max = Math.max(1, ...dias);
  return (
    <article className="ini-uso">
      <header className="ini-uso-topo">
        <span className="ini-uso-avatar" style={{ color: 'var(--pronto)', borderColor: 'var(--pronto)' }}>
          <Ic d={IC_ATIVIDADE} tamanho={14} />
        </span>
        <b className="ini-uso-nome">Atividade</b>
        <span className="ini-etiqueta mono">90 dias</span>
        <span className="ini-vivo">
          <span className="ini-vivo-ponto" /> ao vivo
        </span>
        <button className="icone-botao" onClick={aoAtualizar} aria-label="Atualizar atividade" title="Atualizar">
          <Ic d={IC_ATUALIZAR} tamanho={14} />
        </button>
      </header>
      <div className="ini-uso-numero">
        <span className="mono ini-grande">{total.toLocaleString('pt-BR')}</span>
        <span className="ini-unidade">mensagens</span>
        <span className={`ini-variacao mono ${variacao >= 0 ? 'sobe' : 'desce'}`} title="Últimos 30 dias contra os 30 anteriores">
          {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao)}%
        </span>
      </div>
      <div className="ini-barras" aria-label={`Mensagens por dia nos últimos 90 dias, ${total} no total`} role="img">
        {dias.map((n, i) => (
          <span key={i} style={{ height: `${Math.max(10, (n / max) * 100)}%` }} className={i === dias.length - 1 ? 'hoje' : ''} />
        ))}
      </div>
      <p className="ini-uso-rodape">
        <span>há 90 dias</span>
        <span>hoje</span>
      </p>
    </article>
  );
}

// ---------- tela ----------

export function Inicio({ nome }: { nome?: string }) {
  const e = useLoja();
  const agora = useRelogio();
  const quem = (nome ?? nomeUsuario()).trim();
  const projetos = useMemo(() => projetosRecentes(e), [e.sessoes, e.vertices]); // eslint-disable-line react-hooks/exhaustive-deps
  const pastas = useMemo(() => [...new Set(e.sessoes.map((s) => s.pasta))], [e.sessoes]);
  const [usos, setUsos] = useState<UsoDoPlano[]>([]);
  const [dias, setDias] = useState<number[]>(atividade90Dias);

  const atualizarUso = () => nativo.processos.usoDoPlano().then(setUsos);
  useEffect(() => {
    atualizarUso();
    const t = window.setInterval(() => {
      atualizarUso();
      setDias(atividade90Dias());
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (!ev.ctrlKey || ev.altKey || ev.metaKey) return;
      const tecla = ev.key.toLowerCase();
      if (!ev.shiftKey && tecla === 't') {
        ev.preventDefault();
        novoTerminal();
      } else if (ev.shiftKey && tecla === 'p') {
        ev.preventDefault();
        novoProjeto();
      } else if (ev.shiftKey && tecla === 'g') {
        ev.preventDefault();
        novoGrupo();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const abrirProjeto = (p: Projeto) => selecionarSessao(p.sessaoId);

  return (
    <div className="inicio">
      <FundoDither />
      <div className="inicio-conteudo">
        <section className="ini-topo">
          <h1 className="ini-saudacao">
            {saudacao(agora.getHours())}
            {quem ? `, ${quem}.` : '.'}
          </h1>
          <p className="ini-data mono">{dataCurta(agora)}</p>
          <CaixaComando pastas={pastas} />
          <div className="ini-atalhos">
            <button className="ini-atalho mono" onClick={novoTerminal}>
              <Ic d={IC_TERMINAL} /> novo terminal
            </button>
            <button className="ini-atalho mono" onClick={novoProjeto}>
              <Ic d={IC_PROJETO} /> novo projeto
            </button>
          </div>
        </section>

        <hr className="ini-divisa" />

        <section className="ini-secao" aria-labelledby="ini-recentes">
          <h2 id="ini-recentes" className="ini-secao-titulo">
            PROJETOS RECENTES <span className="ini-contagem mono">{projetos.length}</span>
          </h2>
          {projetos.length ? (
            <div className="ini-grade-projetos">
              {projetos.slice(0, 6).map((p) => (
                <button key={p.pasta} className="ini-projeto" onClick={() => abrirProjeto(p)} title={p.pasta}>
                  <span className="ini-avatar" style={{ background: corDoNome(p.nome) }}>
                    {p.nome[0]?.toUpperCase()}
                  </span>
                  <span className="ini-projeto-texto">
                    <b>{p.nome}</b>
                    <span className="mono">
                      {p.terminais} {p.terminais === 1 ? 'terminal' : 'terminais'} · {p.quando ? haQuanto(p.quando) : 'sem atividade'}
                    </span>
                  </span>
                  <Icone nome="seta" tamanho={14} />
                </button>
              ))}
            </div>
          ) : (
            <p className="secundario ini-vazio">Nenhum projeto ainda. Escreva acima o que você quer construir ou abra uma pasta.</p>
          )}
        </section>

        <section className="ini-secao" aria-labelledby="ini-comece">
          <h2 id="ini-comece" className="ini-secao-titulo">COMECE ALGO</h2>
          <div className="ini-grade-comece">
            <button className="ini-comece" onClick={novoTerminal}>
              <Ic d={IC_TERMINAL} /> <span>novo terminal</span> <kbd>Ctrl+T</kbd>
            </button>
            <button className="ini-comece" onClick={novoProjeto}>
              <Ic d={IC_PROJETO} /> <span>novo projeto</span> <kbd>Ctrl+Shift+P</kbd>
            </button>
            <button className="ini-comece" onClick={novoGrupo}>
              <Ic d={IC_GRUPO} /> <span>novo grupo</span> <kbd>Ctrl+Shift+G</kbd>
            </button>
          </div>
        </section>

        <section className="ini-secao" aria-labelledby="ini-uso">
          <h2 id="ini-uso" className="ini-secao-titulo">USO &amp; ATIVIDADE</h2>
          <div className="ini-grade-uso">
            {usos.map((u) => (
              <CartaoUso key={u.provedor} uso={u} aoAtualizar={atualizarUso} />
            ))}
            {!usos.some((u) => u.provedor === 'Claude') && (
              <article className="ini-uso ini-uso-espera">
                <header className="ini-uso-topo">
                  <span className="ini-uso-avatar"><LogoAgente agente="claude" tamanho={18} /></span>
                  <b className="ini-uso-nome">{NOME_AGENTE.claude}</b>
                  <button className="icone-botao" onClick={atualizarUso} aria-label="Atualizar uso do Claude" title="Atualizar">
                    <Ic d={IC_ATUALIZAR} tamanho={14} />
                  </button>
                </header>
                <p className="ini-uso-aviso">O uso do plano aparece aqui assim que uma sessão do Claude rodar pelo Hypercube.</p>
              </article>
            )}
            <CartaoAtividade dias={dias} aoAtualizar={() => setDias(atividade90Dias())} />
          </div>
        </section>
      </div>
    </div>
  );
}
