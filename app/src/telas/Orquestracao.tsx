// Canvas de orquestração: nós são agentes, ligações dizem quem passa trabalho para quem
// e em que condição. Cada nó mostra estado, custo, tokens e diff ao vivo.
import { LogoAgente } from '../componentes/LogoAgente';
import { useEffect, useMemo, useState } from 'react';
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  avisar,
  corDoAgente,
  criarVertice,
  DESCRICAO_PAPEL,
  ESTADO_INFO,
  focar,
  NOME_AGENTE,
  NOME_NIVEL,
  NOME_PAPEL,
  nomeDoAgente,
  padraoDoPapel,
  useLoja,
  type Nivel,
  type Papel,
  type Vertice,
} from '../estado/loja';
import { nativo, type Agente } from '../nativo';
import { BarraTopo } from '../componentes/BarraTopo';
import { formatarCusto, formatarTokens, Icone, MiniVertice, SimboloEstado } from '../componentes/Pecas';
import { MascoteAgente } from '../componentes/EditarAgente';

/** Cor e nome de um nó: os do agente vivo ou, sem agente, os padrões do papel. */
const corDoNo = (d: DadosNo) => (d.v ? corDoAgente(d.v) : padraoDoPapel(d.papel).cor);
const nomeDoNo = (d: DadosNo) => (d.v ? nomeDoAgente(d.v) : padraoDoPapel(d.papel).apelido);

export type DadosNo = { papel: Papel; agente: Agente; nivel: Nivel; tarefa: string; v?: Vertice };
export type NoVertice = Node<DadosNo, 'vertice'>;

const CONDICOES = ['sempre', 'depois do explorador', 'testes passaram', 'testes falharam', 'revisão pediu mudanças', 'custo < US$ 2', 'cota ok'];

const aresta = (id: string, source: string, target: string, condicao: string): Edge => ({
  id,
  source,
  target,
  label: condicao,
  type: 'smoothstep',
  data: { condicao },
  markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--borda-forte)' },
  style: { stroke: 'var(--borda-forte)', strokeWidth: 1.6 },
  labelStyle: { fill: 'var(--texto-2)', fontSize: 13, fontFamily: 'Geist Mono, monospace' },
  labelBgStyle: { fill: 'var(--fundo)' },
  labelBgPadding: [6, 3],
  labelBgBorderRadius: 4,
});

const no = (id: string, x: number, y: number, papel: Papel, agente: Agente, nivel: Nivel, tarefa: string): NoVertice => ({
  id,
  type: 'vertice',
  position: { x, y },
  data: { papel, agente, nivel, tarefa },
});

interface Roteiro {
  nome: string;
  descricao: string;
  nos: NoVertice[];
  arestas: Edge[];
}

const ROTEIROS: Roteiro[] = [
  {
    nome: 'Planejar, construir, revisar',
    descricao: 'O líder divide, o explorador mapeia, o construtor faz e o revisor confere.',
    nos: [
      no('n1', 200, 0, 'lider', 'claude', 'forte', 'Divida a tarefa entre os agentes'),
      no('n2', 60, 180, 'batedor', 'gemini', 'barato', 'Mapeie os arquivos envolvidos'),
      no('n3', 340, 180, 'construtor', 'codex', 'padrao', 'Implemente a mudança no seu worktree'),
      no('n4', 340, 370, 'revisor', 'claude', 'padrao', 'Revise o diff do Construtor, só lendo'),
      no('n5', 340, 570, 'consertador', 'claude', 'padrao', 'Corrija o que a revisão apontou'),
    ],
    arestas: [
      aresta('a1', 'n1', 'n2', 'sempre'),
      aresta('a2', 'n1', 'n3', 'custo < US$ 2'),
      aresta('a3', 'n3', 'n4', 'testes passaram'),
      aresta('a4', 'n4', 'n5', 'revisão pediu mudanças'),
    ],
  },
  {
    nome: 'Corrida de 3',
    descricao: 'Três construtores fazem a mesma tarefa; o revisor ajuda a escolher o melhor.',
    nos: [
      no('n1', 280, 0, 'lider', 'claude', 'forte', 'Prepare a tarefa da corrida'),
      no('n2', 0, 190, 'construtor', 'claude', 'padrao', 'Implemente a tarefa'),
      no('n3', 280, 190, 'construtor', 'codex', 'padrao', 'Implemente a tarefa'),
      no('n4', 560, 190, 'construtor', 'gemini', 'barato', 'Implemente a tarefa'),
      no('n5', 280, 400, 'revisor', 'claude', 'forte', 'Compare os três diffs e indique o melhor'),
    ],
    arestas: [
      aresta('a1', 'n1', 'n2', 'sempre'),
      aresta('a2', 'n1', 'n3', 'sempre'),
      aresta('a3', 'n1', 'n4', 'cota ok'),
      aresta('a4', 'n2', 'n5', 'testes passaram'),
      aresta('a5', 'n3', 'n5', 'testes passaram'),
      aresta('a6', 'n4', 'n5', 'testes passaram'),
    ],
  },
  {
    nome: 'Consertar um bug',
    descricao: 'O explorador acha a causa, o mecânico corrige e o revisor confere.',
    nos: [
      no('n1', 0, 0, 'batedor', 'gemini', 'barato', 'Encontre onde o erro acontece'),
      no('n2', 0, 190, 'consertador', 'claude', 'padrao', 'Corrija e escreva um teste'),
      no('n3', 0, 380, 'revisor', 'codex', 'padrao', 'Revise a correção'),
    ],
    arestas: [aresta('a1', 'n1', 'n2', 'sempre'), aresta('a2', 'n2', 'n3', 'testes passaram')],
  },
];

export function NoVerticeView({ data, selected }: NodeProps<NoVertice>) {
  const v = data.v;
  const estado = v?.estado;
  return (
    <div className={`no-vertice com-cor-agente ${selected ? 'selecionado' : ''} ${v ? `estado-borda-${estado}` : 'nao-iniciado'}`} style={{ ['--cor-papel' as string]: corDoNo(data), ['--cor-agente' as string]: corDoNo(data) }}>
      <Handle type="target" position={Position.Top} />
      <div className="no-cabeca">
        <MascoteAgente cor={corDoNo(data)} papel={data.papel} tamanho={22} estado={estado} />
        <div>
          <b>{nomeDoNo(data)}</b>
          <div className="no-meta">
            <LogoAgente agente={data.agente} tamanho={12} /> {NOME_AGENTE[data.agente]} · {NOME_NIVEL[data.nivel]}
          </div>
        </div>
        {estado ? <SimboloEstado estado={estado} /> : <span className="no-parado">○</span>}
      </div>
      <div className="no-tarefa">{v?.ultimaAcao ? `${v.ultimaAcao}` : data.tarefa}</div>
      {v && (v.custo > 0 || v.tokens > 0 || v.diff.mais > 0 || v.diff.menos > 0) && (
      <div className="no-numeros mono">
        <span>{formatarCusto(v?.custo ?? 0)}</span>
        <span>{formatarTokens(v?.tokens ?? 0)} tk</span>
        <span>
          <span className="mais">+{v?.diff.mais ?? 0}</span> <span className="menos">−{v?.diff.menos ?? 0}</span>
        </span>
      </div>
      )}
      {v?.estado === 'esperando' && <div className="no-espera">◆ {v.pergunta}</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const tiposNo = { vertice: NoVerticeView };

// Mantém o roteiro editado ao trocar de tela.
const memoria: { indice: number; nos?: NoVertice[]; arestas?: Edge[]; limite: number } = { indice: 0, limite: 2 };

export function Orquestracao() {
  const e = useLoja();
  const sessao = e.sessoes.find((s) => s.id === e.sessaoAtivaId);
  const [indice, setIndice] = useState(memoria.indice);
  const [nos, setNos, aoMudarNos] = useNodesState<NoVertice>(memoria.nos ?? ROTEIROS[indice].nos);
  const [arestas, setArestas, aoMudarArestas] = useEdgesState<Edge>(memoria.arestas ?? ROTEIROS[indice].arestas);
  const [selNo, setSelNo] = useState<string | null>(null);
  const [selAresta, setSelAresta] = useState<string | null>(null);
  const [limite, setLimite] = useState(memoria.limite);
  const [entrega, setEntrega] = useState<{ nome: string; texto: string } | null>(null);

  useEffect(() => {
    Object.assign(memoria, { indice, nos, arestas, limite });
  }, [indice, nos, arestas, limite]);

  // Liga cada nó a um agente vivo da sessão com o mesmo papel.
  const vivos = useMemo(() => {
    const livres = e.vertices.filter((v) => v.sessaoId === sessao?.id && !v.paiId);
    const mapa = new Map<string, Vertice>();
    nos.forEach((n) => {
      const i = livres.findIndex((v) => v.papel === n.data.papel);
      if (i >= 0) {
        mapa.set(n.id, livres[i]);
        livres.splice(i, 1);
      }
    });
    return mapa;
  }, [e.vertices, nos, sessao?.id]);

  const nosVivos = nos.map((n) => ({ ...n, data: { ...n.data, v: vivos.get(n.id) } }));
  const arestasVivas = arestas.map((a) => {
    const v = vivos.get(a.source);
    const ativa = v?.estado === 'trabalhando';
    return { ...a, animated: ativa, style: { ...a.style, stroke: ativa ? 'var(--cobalto-claro)' : 'var(--borda-forte)' } };
  });

  const noSel = nosVivos.find((n) => n.id === selNo);
  const arestaSel = arestas.find((a) => a.id === selAresta);
  const custoRodada = [...vivos.values()].reduce((s, v) => s + v.custo, 0);

  const trocarRoteiro = (i: number) => {
    setIndice(i);
    setNos(ROTEIROS[i].nos);
    setArestas(ROTEIROS[i].arestas);
    setSelNo(null);
    setSelAresta(null);
  };

  const mudarNo = (id: string, d: Partial<DadosNo>) => setNos((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...d } } : n)));

  const adicionar = (papel: Papel) => {
    const id = `n${Date.now().toString(36)}`;
    setNos((ns) => [...ns, no(id, 80 + ns.length * 30, 420 + (ns.length % 3) * 20, papel, 'claude', 'padrao', DESCRICAO_PAPEL[papel])]);
    setSelNo(id);
  };

  const rodar = async () => {
    if (!sessao) return;
    const faltando = nos.filter((n) => !vivos.has(n.id));
    const ativos = e.vertices.filter((v) => v.sessaoId === sessao.id && v.estado === 'trabalhando').length;
    if (ativos + faltando.length > 8) {
      avisar('Limite: até 8 agentes trabalhando ao mesmo tempo.', 'erro');
      return;
    }
    if (!faltando.length) {
      avisar('Todos os nós já têm um agente rodando nesta sessão.');
      return;
    }
    for (const n of faltando) await criarVertice(sessao.id, n.data.papel, n.data.agente, n.data.nivel, n.data.tarefa);
    avisar(`Roteiro “${ROTEIROS[indice].nome}” começou com ${faltando.length} agentes.`, 'trabalhando');
  };

  const abrirEntrega = async (arquivo: string) => {
    setEntrega({ nome: arquivo, texto: await nativo.arquivos.ler(`vertices/${noSel?.data.papel}/${arquivo}`) });
  };

  return (
    <div className="tela-orquestracao">
      <BarraTopo titulo="Orquestração" subtitulo={sessao ? `${sessao.nome} · ${sessao.pasta}` : 'Nenhuma sessão'} />
      <div className="orq-corpo">
        <div className="orq-canvas">
          <ReactFlow
            nodes={nosVivos}
            edges={arestasVivas}
            nodeTypes={tiposNo}
            onNodesChange={aoMudarNos}
            onEdgesChange={aoMudarArestas}
            onConnect={(c) => setArestas((as) => addEdge(aresta(`a${Date.now().toString(36)}`, c.source, c.target, 'sempre'), as))}
            onNodeClick={(_, n) => {
              setSelNo(n.id);
              setSelAresta(null);
              setEntrega(null);
            }}
            onNodeDoubleClick={(_, n) => {
              const v = vivos.get(n.id);
              if (v) focar(v.id);
            }}
            onEdgeClick={(_, a) => {
              setSelAresta(a.id);
              setSelNo(null);
            }}
            onPaneClick={() => {
              setSelNo(null);
              setSelAresta(null);
            }}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
          >
            <Background color="var(--borda)" gap={22} size={1.4} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(n) => corDoNo(n.data as DadosNo)} maskColor="color-mix(in srgb, var(--terminal) 70%, transparent)" style={{ background: 'var(--fundo-lateral)', width: 150, height: 96 }} />
          </ReactFlow>
        </div>

        <aside className="orq-painel">
          <section>
            <h3>Roteiro</h3>
            <select value={indice} onChange={(ev) => trocarRoteiro(Number(ev.target.value))} aria-label="Roteiro">
              {ROTEIROS.map((r, i) => (
                <option key={r.nome} value={i}>
                  {r.nome}
                </option>
              ))}
            </select>
            <p className="secundario">{ROTEIROS[indice].descricao}</p>
            <label className="campo-linha">
              <span>Limite de custo por rodada</span>
              <span className="entrada-valor">
                US$
                <input type="number" min={0.5} step={0.5} value={limite} onChange={(ev) => setLimite(Number(ev.target.value))} />
              </span>
            </label>
            <div className="medidor">
              <span className="mono">
                {formatarCusto(custoRodada)} de {formatarCusto(limite)}
              </span>
              <span className="barra-trilho">
                <span className="barra-cheia" style={{ width: `${Math.min(100, (custoRodada / limite) * 100)}%`, background: custoRodada > limite ? 'var(--erro)' : 'var(--cobalto-claro)' }} />
              </span>
            </div>
            <button className="botao primario largo" onClick={rodar} disabled={!sessao}>
              <Icone nome="enviar" /> Rodar roteiro nesta sessão
            </button>
          </section>

          <section>
            <h3>Adicionar nó</h3>
            <div className="papeis">
              {(['lider', 'batedor', 'construtor', 'revisor', 'consertador'] as Papel[]).map((p) => (
                <button key={p} className="chip" onClick={() => adicionar(p)} title={DESCRICAO_PAPEL[p]}>
                  <MiniVertice papel={p} tamanho={14} /> {NOME_PAPEL[p]}
                </button>
              ))}
            </div>
          </section>

          {noSel && (
            <section className="inspetor">
              <h3>
                <MascoteAgente cor={corDoNo(noSel.data)} papel={noSel.data.papel} tamanho={18} /> {nomeDoNo(noSel.data)}
              </h3>
              {noSel.data.v && (
                <p className="linha-estado">
                  <SimboloEstado estado={noSel.data.v.estado} comNome /> <span className="secundario">{noSel.data.v.ultimaAcao}</span>
                </p>
              )}
              <label className="campo">
                <span>Papel</span>
                <select value={noSel.data.papel} onChange={(ev) => mudarNo(noSel.id, { papel: ev.target.value as Papel })}>
                  {(['lider', 'batedor', 'construtor', 'revisor', 'consertador'] as Papel[]).map((p) => (
                    <option key={p} value={p}>
                      {NOME_PAPEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                <span>Agente</span>
                <select value={noSel.data.agente} onChange={(ev) => mudarNo(noSel.id, { agente: ev.target.value as Agente })}>
                  {(Object.keys(NOME_AGENTE) as Agente[]).map((a) => (
                    <option key={a} value={a}>
                      {NOME_AGENTE[a]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="campo">
                <span>Nível</span>
                <div className="segmentos">
                  {(['barato', 'padrao', 'forte'] as Nivel[]).map((n) => (
                    <button key={n} className={noSel.data.nivel === n ? 'ativo' : ''} onClick={() => mudarNo(noSel.id, { nivel: n })}>
                      {NOME_NIVEL[n]}
                    </button>
                  ))}
                </div>
                {noSel.data.nivel === 'barato' && <small className="secundario">Vai pelo roteador para modelos gratuitos.</small>}
              </div>
              <label className="campo">
                <span>Tarefa</span>
                <textarea rows={2} value={noSel.data.tarefa} onChange={(ev) => mudarNo(noSel.id, { tarefa: ev.target.value })} />
              </label>
              {noSel.data.v && (
                <>
                  <div className="campo">
                    <span>Entregas</span>
                    <div className="entregas">
                      {['resultado.md', 'saida.json', 'diff.patch'].map((a) => (
                        <button key={a} className={`chip ${entrega?.nome === a ? 'ativo' : ''}`} onClick={() => abrirEntrega(a)}>
                          <Icone nome="arquivo" tamanho={12} /> {a}
                        </button>
                      ))}
                    </div>
                    {entrega && <pre className="entrega-texto">{entrega.texto}</pre>}
                  </div>
                  <button className="botao largo" onClick={() => focar(noSel.data.v!.id)}>
                    Abrir o terminal
                  </button>
                </>
              )}
              <button
                className="botao perigo largo"
                onClick={() => {
                  setNos((ns) => ns.filter((n) => n.id !== noSel.id));
                  setArestas((as) => as.filter((a) => a.source !== noSel.id && a.target !== noSel.id));
                  setSelNo(null);
                }}
              >
                Tirar do roteiro
              </button>
            </section>
          )}

          {arestaSel && (
            <section className="inspetor">
              <h3>Ligação</h3>
              <label className="campo">
                <span>Passa o trabalho quando</span>
                <select
                  value={String((arestaSel.data as { condicao: string }).condicao)}
                  onChange={(ev) => setArestas((as) => as.map((a) => (a.id === arestaSel.id ? aresta(a.id, a.source, a.target, ev.target.value) : a)))}
                >
                  {CONDICOES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <button
                className="botao perigo largo"
                onClick={() => {
                  setArestas((as) => as.filter((a) => a.id !== arestaSel.id));
                  setSelAresta(null);
                }}
              >
                Apagar ligação
              </button>
            </section>
          )}

          {!noSel && !arestaSel && (
            <section className="legenda">
              <h3>Estados</h3>
              {(Object.keys(ESTADO_INFO) as (keyof typeof ESTADO_INFO)[]).map((k) => (
                <div key={k}>
                  <SimboloEstado estado={k} comNome />
                </div>
              ))}
              <div className="secundario">○ Ainda não iniciado</div>
              <p className="dica">Clique para editar. Arraste da bolinha para ligar.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
