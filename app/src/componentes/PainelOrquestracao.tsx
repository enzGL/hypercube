// Painel de orquestração preso embaixo dos terminais: uma aba por planner (líder),
// o canvas com quem ele chamou, o resumo dos workers e um campo para dar mais trabalho.
import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  MarkerType,
  Panel,
  ReactFlow,
  useReactFlow,
  useViewport,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  avisar,
  corDoAgente,
  criarVertice,
  ESTADO_INFO,
  focar,
  lideresDaSessao,
  mandar,
  NOME_AGENTE,
  nomeDoAgente,
  ordenados,
  resumoOrquestracao,
  trabalhadoresDoLider,
  useLoja,
  type Vertice,
} from '../estado/loja';
import { nativo, type UsoDoPlano } from '../nativo';
import { NoVerticeView, type NoVertice } from '../telas/Orquestracao';
import { formatarCusto, formatarTokens, Icone, SimboloEstado } from './Pecas';
import { HiperMini } from './HiperMini';
import '../orquestracao.css';
import { MascoteAgente } from './EditarAgente';

const tiposNo = { vertice: NoVerticeView };

const CHAVE = 'hypercube.orquestracao';

function lerPreferencias(): { aberto: boolean; limite: number } {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    if (p && typeof p.limite === 'number') return { aberto: p.aberto !== false, limite: p.limite };
  } catch {
    /* sem armazenamento */
  }
  // Em tela baixa o painel começa recolhido, para os terminais não ficarem com duas linhas.
  return { aberto: window.innerHeight >= 860, limite: 4 };
}

function salvarPreferencias(p: { aberto: boolean; limite: number }) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    /* sem armazenamento */
  }
}

// Mantém a aba escolhida ao trocar de tela.
const memoria: { aba: Record<string, string> } = { aba: {} };

const corUso = (n: number) => (n > 90 ? 'var(--erro)' : n > 70 ? 'var(--esperando)' : 'var(--texto-2)');

interface Props {
  /** Sessão mostrada; sem isso usa a sessão ativa. */
  sessaoId?: string | null;
}

export function PainelOrquestracao({ sessaoId }: Props) {
  const e = useLoja();
  const sid = sessaoId ?? e.sessaoAtivaId;
  const lideres = lideresDaSessao(e, sid);
  const [pref, setPref] = useState(lerPreferencias);
  const [abaId, setAbaId] = useState<string | null>(sid ? memoria.aba[sid] ?? null : null);
  const [uso, setUso] = useState<UsoDoPlano[]>([]);
  // Com só um agente na sessão o painel começa recolhido, até a pessoa abrir.
  const [escolheu, setEscolheu] = useState(false);
  const poucos = e.vertices.filter((v) => v.sessaoId === sid).length <= 1;
  const aberto = escolheu ? pref.aberto : pref.aberto && !poucos;

  useEffect(() => {
    nativo.processos.usoDoPlano().then(setUso);
  }, []);
  useEffect(() => salvarPreferencias(pref), [pref]);

  const lider = lideres.find((l) => l.id === abaId) ?? lideres[0] ?? null;
  useEffect(() => {
    if (sid && lider) memoria.aba[sid] = lider.id;
  }, [sid, lider]);

  // Sem líder, o painel mostra todos os agentes da sessão: dá para orquestrar sem papéis.
  const workers = lider ? trabalhadoresDoLider(e, lider.id) : ordenados(e, sid ?? '').filter((v) => v.papel !== 'subagente');
  const r = resumoOrquestracao(workers, pref.limite);
  const usoLider = uso.find((u) => u.provedor.toLowerCase() === (lider?.agente ?? 'claude'));

  const novoPlanner = async () => {
    if (!sid) return;
    const v = await criarVertice(sid, 'lider', 'claude', 'forte');
    setAbaId(v.id);
  };

  const mudarLimite = (n: number) => setPref((p) => ({ ...p, limite: Math.max(1, Math.min(8, Math.round(n) || 1)) }));

  return (
    <section className={`po ${aberto ? 'po-aberto' : 'po-fechado'}`} aria-label="Com agentes">
      <header className="po-cabeca">
        <button
          className="po-recolher"
          onClick={() => {
            setEscolheu(true);
            setPref((p) => ({ ...p, aberto: !aberto }));
          }}
          aria-expanded={aberto}
          title={aberto ? 'Recolher o painel' : 'Abrir o painel'}
        >
          <Icone nome={aberto ? 'baixo' : 'cima'} tamanho={14} />
          <span className="po-titulo">Com agentes</span>
        </button>

        {usoLider && (
          <span className="po-uso mono" style={{ color: corUso(usoLider.cincoHoras) }} title="Uso do plano nas últimas 5 horas">
            {NOME_AGENTE[lider?.agente ?? 'claude'].toLowerCase()} em {usoLider.cincoHoras}% (reseta {usoLider.renovaEm})
          </span>
        )}

        <span className="po-contas mono">
          {r.rodando} rodando · {r.naFila} na fila · limite{' '}
          <input
            className="po-limite"
            type="number"
            min={1}
            max={8}
            value={pref.limite}
            onChange={(ev) => mudarLimite(Number(ev.target.value))}
            aria-label="Limite de agentes rodando ao mesmo tempo"
            title="Quantos agentes podem rodar ao mesmo tempo"
          />
        </span>

        <div className="po-abas" role="tablist" aria-label="Líderes">
          {lideres.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={l.id === lider?.id}
              className={`po-aba ${l.id === lider?.id ? 'ativa' : ''}`}
              onClick={() => {
                setAbaId(l.id);
                setEscolheu(true);
                if (!aberto) setPref((p) => ({ ...p, aberto: true }));
              }}
              title={l.tarefa ?? nomeDoAgente(l)}
            >
              <HiperMini estado={l.estado} tamanho={12} />
              {nomeDoAgente(l)}
            </button>
          ))}
          <button className="po-aba po-mais" onClick={novoPlanner} disabled={!sid} title="Novo líder" aria-label="Novo líder">
            <Icone nome="mais" tamanho={13} />
          </button>
        </div>
      </header>

      {aberto && (
        <>
          <div className="po-corpo">
            <CanvasPlanner lider={lider} workers={workers} />
            <Resumo r={r} workers={workers} />
          </div>
          <Rodape workers={workers} lider={lider} />
        </>
      )}
    </section>
  );
}

// ---------- canvas ----------

function CanvasPlanner({ lider, workers }: { lider: Vertice | null; workers: Vertice[] }) {
  const vazio = workers.length === 0;
  const { nos, arestas } = useMemo(() => (vazio ? { nos: [], arestas: [] } : montarGrafo(lider, workers)), [vazio, lider, workers]);
  const chave = `${lider?.id ?? 'nada'}-${workers.length}`;
  return (
    <div className="po-canvas">
      <ReactFlow
        key={chave}
        nodes={nos}
        edges={arestas}
        nodeTypes={tiposNo}
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeDoubleClick={(_, n) => n.data.v && focar(n.data.v.id)}
        zoomOnScroll={false}
        zoomActivationKeyCode="Control"
        panOnDrag
        minZoom={0.3}
        maxZoom={1.6}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 0.9 }}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background color="var(--borda)" gap={20} size={1.2} />
        <ControlesZoom />
      </ReactFlow>
      {vazio && (
        <div className="po-vazio">
          <HiperMini estado="repouso" tamanho={28} />
          <b>{lider ? 'Este líder ainda não passou trabalho para ninguém' : 'Nenhum agente nesta sessão'}</b>
          <span className="secundario">
            {lider ? 'Quando ele chamar outros agentes, eles aparecem aqui ligados a ele.' : 'Crie agentes na sessão. Se quiser que um deles divida o trabalho, use o + para um Líder.'}
          </span>
        </div>
      )}
      <span className="po-dica-canvas">Arraste o canvas para mover · Ctrl + scroll para dar zoom</span>
    </div>
  );
}

function ControlesZoom() {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-right" className="po-zoom">
      <button onClick={() => zoomOut({ duration: 150 })} aria-label="Diminuir zoom" title="Diminuir zoom">
        <Icone nome="menos" tamanho={13} />
      </button>
      <button onClick={() => fitView({ padding: 0.12, duration: 200 })} title="Ajustar à tela">
        ajustar
      </button>
      <button className="mono" onClick={() => zoomTo(1, { duration: 150 })} title="Voltar para 100%">
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={() => zoomIn({ duration: 150 })} aria-label="Aumentar zoom" title="Aumentar zoom">
        <Icone nome="mais" tamanho={13} />
      </button>
    </Panel>
  );
}

function montarGrafo(lider: Vertice | null, workers: Vertice[]): { nos: NoVertice[]; arestas: Edge[] } {
  const largura = 250;
  const total = workers.length;
  const no = (v: Vertice, x: number, y: number): NoVertice => ({
    id: v.id,
    type: 'vertice',
    position: { x, y },
    data: { papel: v.papel, agente: v.agente, nivel: v.nivel, tarefa: v.tarefa ?? '', v },
  });
  // Sem líder: os agentes lado a lado, sem ligações.
  if (!lider) return { nos: workers.map((w, i) => no(w, i * largura, 0)), arestas: [] };
  const nos = [no(lider, ((total - 1) * largura) / 2, 0), ...workers.map((w, i) => no(w, i * largura, 200))];
  const arestas: Edge[] = workers.map((w) => {
    const ativa = w.estado === 'trabalhando';
    const cor = ativa ? 'var(--cobalto-claro)' : 'var(--borda-forte)';
    return {
      id: `${lider.id}-${w.id}`,
      source: w.paiId ?? lider.id,
      target: w.id,
      type: 'smoothstep',
      animated: ativa,
      markerEnd: { type: MarkerType.ArrowClosed, color: cor },
      style: { stroke: cor, strokeWidth: 1.6 },
    };
  });
  return { nos, arestas };
}

// ---------- resumo ----------

type Contador = { chave: string; nome: string; valor: string | number; simbolo: string; cor: string };

function Resumo({ r, workers }: { r: ReturnType<typeof resumoOrquestracao>; workers: Vertice[] }) {
  const linhas: Contador[] = [
    { chave: 'esperando', nome: 'esperando você', valor: r.esperando, simbolo: ESTADO_INFO.esperando.simbolo, cor: 'var(--esperando)' },
    { chave: 'rodando', nome: 'rodando', valor: r.rodando, simbolo: ESTADO_INFO.trabalhando.simbolo, cor: 'var(--trabalhando)' },
    { chave: 'fila', nome: 'na fila', valor: r.naFila, simbolo: '◌', cor: 'var(--texto-2)' },
    { chave: 'interrompidos', nome: 'interrompidos', valor: r.interrompidos, simbolo: '◇', cor: 'var(--esperando)' },
    { chave: 'falhou', nome: 'falhou', valor: r.falhou, simbolo: ESTADO_INFO.erro.simbolo, cor: 'var(--erro)' },
    { chave: 'encerrados', nome: 'prontos', valor: r.encerrados, simbolo: ESTADO_INFO.pronto.simbolo, cor: 'var(--pronto)' },
    { chave: 'vagas', nome: 'vagas em uso', valor: `${r.vagasEmUso}/${r.limite}`, simbolo: '▣', cor: 'var(--cobalto-claro)' },
  ];
  return (
    <aside className="po-resumo">
      <div className="po-progresso">
        <span>
          <b className="mono">{r.concluidos}</b> de <b className="mono">{r.total}</b> agentes
        </span>
        <span className="mono po-porcento">{r.porcento}%</span>
      </div>
      <span className="barra-trilho po-trilho">
        <span className="barra-cheia" style={{ width: `${r.porcento}%`, background: 'var(--pronto)' }} />
      </span>
      <ul className="po-contadores">
        {linhas.map((l) => (
          <li key={l.chave} className={l.valor === 0 || l.valor === `0/${r.limite}` ? 'zero' : ''}>
            <span className="po-simbolo" style={{ color: l.cor }} aria-hidden="true">
              {l.simbolo}
            </span>
            <span className="po-nome">{l.nome}</span>
            <b className="mono">{l.valor}</b>
          </li>
        ))}
      </ul>

      <h4 className="po-secao">Execuções</h4>
      {workers.length === 0 ? (
        <p className="dica">Nenhuma execução ainda.</p>
      ) : (
        <ul className="po-execucoes">
          {workers.map((w) => (
            <li key={w.id}>
              <button onClick={() => focar(w.id)} title="Abrir o terminal">
                <MascoteAgente cor={corDoAgente(w)} papel={w.papel} tamanho={16} estado={w.estado} />
                <span className="po-exec-texto">
                  <b>{nomeDoAgente(w)}</b>
                  <span className="secundario">{w.estado === 'esperando' ? w.pergunta : w.ultimaAcao ?? w.tarefa}</span>
                </span>
                <span className="po-exec-num mono">
                  {formatarCusto(w.custo)}
                  <br />
                  {formatarTokens(w.tokens)} tk
                </span>
                <SimboloEstado estado={w.estado} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// ---------- rodapé ----------

function Rodape({ workers, lider }: { workers: Vertice[]; lider: Vertice | null }) {
  const [alvoId, setAlvoId] = useState('');
  const [texto, setTexto] = useState('');
  const alvo = workers.find((w) => w.id === alvoId) ?? (lider?.id === alvoId ? lider : undefined);

  const enviar = () => {
    const t = texto.trim();
    if (!alvo || !t) return;
    mandar(alvo.id, t);
    avisar(`Mais trabalho mandado para ${nomeDoAgente(alvo)}.`, 'trabalhando', alvo.id);
    setTexto('');
  };

  return (
    <form
      className="po-rodape"
      onSubmit={(ev) => {
        ev.preventDefault();
        enviar();
      }}
    >
      <select value={alvo ? alvo.id : ''} onChange={(ev) => setAlvoId(ev.target.value)} aria-label="Worker que recebe o trabalho">
        <option value="">Escolha um agente…</option>
        {lider && <option value={lider.id}>{nomeDoAgente(lider)} (líder)</option>}
        {workers.map((w) => (
          <option key={w.id} value={w.id}>
            {ESTADO_INFO[w.estado].simbolo} {nomeDoAgente(w)}
          </option>
        ))}
      </select>
      <input
        value={texto}
        onChange={(ev) => setTexto(ev.target.value)}
        placeholder={alvo ? `Dar mais trabalho a ${nomeDoAgente(alvo)}…` : 'Dar mais trabalho a ele…'}
        disabled={!alvo}
        aria-label="Trabalho novo"
      />
      <button className="botao primario" type="submit" disabled={!alvo || !texto.trim()} title="Mandar">
        <Icone nome="enviar" tamanho={14} />
      </button>
    </form>
  );
}
