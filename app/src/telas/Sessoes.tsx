import { useEffect, useRef, useState } from 'react';
import { abrirMenu } from '../componentes/MenuContexto';
import { EVENTO_CAMPO, EVENTO_RENOMEAR, menuAgente } from '../estado/menus';
import { LogoAgente } from '../componentes/LogoAgente';
import {
  abrirDialogo,
  definirColunas,
  definirOrquestracao,
  temOrquestracao,
  definirLayout,
  encerrar,
  escolherVencedor,
  focar,
  iniciarCorrida,
  interromper,
  mandar,
  mandarParaTodos,
  mover,
  novoTerminal,
  NOME_AGENTE,
  NOME_NIVEL,
  ocultar,
  ordenados,
  reabrir,
  reabrirTodos,
  responder,
  revisaoCruzada,
  avisar,
  corDoAgente,
  descreverPedido,
  nomeDoAgente,
  useLoja,
  type Estado,
  type Layout,
  type Vertice,
  COR_PAPEL,
  NOME_PAPEL,
  vagasDaEquipe,
  type Papel,
} from '../estado/loja';
import { BarraTopo } from '../componentes/BarraTopo';
import { Hiper } from '../componentes/Hiper';
import { formatarCusto, formatarTokens, Icone, SimboloEstado } from '../componentes/Pecas';
import { Terminal } from '../componentes/Terminal';
import { Avisos } from '../componentes/Avisos';
import { abrirEditarAgente, IconeLapis, MascoteAgente, NomeEditavel, primeiraEntrada } from '../componentes/EditarAgente';

const LAYOUTS: { id: Layout; nome: string }[] = [
  { id: 'auto', nome: 'Automático' },
  { id: 'foco', nome: 'Foco' },
  { id: 'livre', nome: 'Grade livre' },
];

function colunasAuto(n: number) {
  if (n <= 1) return 1;
  if (n <= 4) return 2;
  return 3;
}

export function Sessoes() {
  const e = useLoja();
  const sessao = e.sessoes.find((s) => s.id === e.sessaoAtivaId);
  if (!sessao) {
    return (
      <div className="vazio">
        <Hiper estado="repouso" tamanho={140} />
        <h2>Nenhuma sessão aberta</h2>
        <p>Crie uma sessão numa pasta do seu projeto para começar.</p>
        <button className="botao primario" onClick={() => abrirDialogo({ tipo: 'novaSessao' })}>
          <Icone nome="mais" /> Nova sessão
        </button>
      </div>
    );
  }

  const todos = ordenados(e, sessao.id);
  const visiveis = todos.filter((v) => !v.oculto);
  const ocultos = todos.filter((v) => v.oculto);
  const encerrados = todos.filter((v) => v.encerrado);
  const corrida = e.corridas.find((c) => c.sessaoId === sessao.id && !c.escolhido && c.ids.length > 0);
  // Modo Equipe: papéis que o Líder ainda vai chamar aparecem como vagas tracejadas.
  const vagas = todos.filter((v) => v.papel === 'lider').flatMap((l) => vagasDaEquipe(e, l.id).map((papel) => ({ papel, lider: l })));

  const acoes = (
    <>
      <div className="segmentos" role="radiogroup" aria-label="Layout">
        {LAYOUTS.map((l) => (
          <button key={l.id} role="radio" aria-checked={e.layout === l.id} className={e.layout === l.id ? 'ativo' : ''} onClick={() => definirLayout(l.id)}>
            {l.nome}
          </button>
        ))}
      </div>
      {e.layout === 'livre' && (
        <div className="passo-colunas" aria-label="Colunas">
          <button onClick={() => definirColunas(e.colunasLivres - 1)} aria-label="Menos colunas">
            <Icone nome="menos" tamanho={14} />
          </button>
          <span>{e.colunasLivres} col.</span>
          <button onClick={() => definirColunas(e.colunasLivres + 1)} aria-label="Mais colunas">
            <Icone nome="mais" tamanho={14} />
          </button>
        </div>
      )}
      <button
        className={`botao ${temOrquestracao(sessao) ? 'ligado' : ''}`}
        aria-pressed={temOrquestracao(sessao)}
        title={temOrquestracao(sessao) ? 'Com agentes ligado. Clique para voltar ao Normal (some o painel da equipe)' : 'Normal. Clique para usar Com agentes: o Líder e a equipe'}
        onClick={() => definirOrquestracao(sessao.id, !temOrquestracao(sessao))}
      >
        <Icone nome="orquestracao" /> Com agentes
      </button>
      <button className="botao" onClick={() => abrirDialogo({ tipo: 'novoVertice', sessaoId: sessao.id })}>
        <Icone nome="mais" /> Agente
      </button>
      <button className="botao primario" onClick={() => novoTerminal(sessao.id)}>
        <Icone nome="mais" /> Terminal
      </button>
    </>
  );

  return (
    <div className="tela-sessoes">
      <BarraTopo titulo={sessao.nome} subtitulo={sessao.pasta} acoes={todos.length ? acoes : undefined} />

      {corrida && <FaixaCorrida e={e} corridaId={corrida.id} />}

      {todos.length === 0 ? (
        <div className="vazio">
          <Hiper estado="repouso" tamanho={150} />
          <h2>Nenhum terminal nesta sessão</h2>
          <p>Abra um terminal na pasta do projeto. Se quiser, rode um agente dentro dele ou crie um agente à parte.</p>
          <div className="vazio-acoes">
            <button className="botao primario" onClick={() => novoTerminal(sessao.id)}>
              <Icone nome="mais" /> Novo terminal
            </button>
            <button className="botao" onClick={() => abrirDialogo({ tipo: 'novoVertice', sessaoId: sessao.id, papel: 'agente' })}>
              Criar agente
            </button>
          </div>
        </div>
      ) : (
        <>
          {encerrados.length > 1 && (
            <div className="faixa-ocultos">
              <Icone nome="parar" tamanho={14} />
              <span>
                {encerrados.length} agentes estão fechados. Eles abrem sem tarefa e esperam você.
              </span>
              <button className="botao pequeno" onClick={() => reabrirTodos(sessao.id)}>
                Abrir todos de novo
              </button>
            </div>
          )}
          {ocultos.length > 0 && (
            <div className="faixa-ocultos">
              <Icone nome="ocultar" tamanho={14} />
              <span>
                {ocultos.length} {ocultos.length === 1 ? 'oculto' : 'ocultos'} (continuam rodando):
              </span>
              {ocultos.map((v) => (
                <button key={v.id} className="chip" onClick={() => ocultar(v.id, false)}>
                  <SimboloEstado estado={v.estado} /> {nomeDoAgente(v)} <Icone nome="olho" tamanho={12} />
                </button>
              ))}
            </div>
          )}
          {visiveis.length === 0 ? (
            <div className="vazio pequeno">
              <Hiper estado="repouso" tamanho={90} />
              <p>Todos os agentes estão ocultos. Eles continuam rodando.</p>
            </div>
          ) : e.layout === 'foco' ? (
            <LayoutFoco e={e} visiveis={visiveis} />
          ) : (
            <div
              className="grade"
              style={{ gridTemplateColumns: `repeat(${e.layout === 'livre' ? e.colunasLivres : colunasAuto(visiveis.length + vagas.length)}, minmax(0, 1fr))` }}
            >
              {visiveis.map((v) => (
                <Painel key={v.id} v={v} e={e} arrastavel={e.layout === 'livre'} />
              ))}
              {vagas.map(({ papel, lider }) => (
                <Vaga key={`${lider.id}-${papel}`} papel={papel} lider={lider} />
              ))}
            </div>
          )}
        </>
      )}

      <Avisos emLinha />
      {temOrquestracao(sessao) && <CampoComando e={e} sessaoId={sessao.id} vertices={todos} />}
    </div>
  );
}

/** Vaga da equipe: o papel que o Líder ainda vai chamar. Some quando ele cria o agente. */
function Vaga({ papel, lider }: { papel: Papel; lider: Vertice }) {
  return (
    <article className="painel vaga" aria-label={`Vaga: ${NOME_PAPEL[papel]}, o Líder vai chamar`}>
      <MascoteAgente cor={COR_PAPEL[papel]} papel={papel} tamanho={34} estado="pronto" />
      <b>{NOME_PAPEL[papel]}</b>
      <span>{nomeDoAgente(lider)} vai chamar</span>
    </article>
  );
}

function LayoutFoco({ e, visiveis }: { e: Estado; visiveis: Vertice[] }) {
  const principal = visiveis.find((v) => v.id === e.focoId) ?? visiveis[0];
  const outros = visiveis.filter((v) => v.id !== principal.id);
  return (
    <div className="layout-foco">
      <Painel v={principal} e={e} />
      {outros.length > 0 && (
        <div className="foco-lista">
          {outros.map((v) => (
            <button key={v.id} className={`cartao-mini estado-borda-${v.estado}`} onClick={() => focar(v.id)}>
              <div className="cartao-mini-topo">
                <MascoteAgente cor={corDoAgente(v)} papel={v.papel} tamanho={18} estado={v.estado} />
                <b>{nomeDoAgente(v)}</b>
                <SimboloEstado estado={v.estado} />
              </div>
              <div className="cartao-mini-linha">{NOME_AGENTE[v.agente]} · {v.ultimaAcao}</div>
              {v.pergunta && <div className="cartao-mini-pergunta">◆ {v.pergunta}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Painel({ v, e, arrastavel }: { v: Vertice; e: Estado; arrastavel?: boolean }) {
  const [confirmar, setConfirmar] = useState(false);
  const [arrastandoSobre, setArrastandoSobre] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [entrada] = useState(() => primeiraEntrada(v.id));
  const nome = nomeDoAgente(v);
  const cor = corDoAgente(v);
  const focado = e.focoId === v.id;
  const filhos = e.vertices.filter((f) => f.paiId === v.id);
  const corrida = v.corridaId ? e.corridas.find((c) => c.id === v.corridaId) : undefined;
  const lider = v.criadoPor ? e.vertices.find((x) => x.id === v.criadoPor) : undefined;
  // "Renomear" no menu do clique direito abre a edição do nome aqui no painel.
  useEffect(() => {
    const f = (ev: Event) => (ev as CustomEvent<string>).detail === v.id && setRenomeando(true);
    window.addEventListener(EVENTO_RENOMEAR, f);
    return () => window.removeEventListener(EVENTO_RENOMEAR, f);
  }, [v.id]);
  const menu = (ev: React.MouseEvent<HTMLElement>) => {
    const ponto = ev.currentTarget;
    abrirMenu(ev, menuAgente(v, () => abrirEditarAgente(v.id, ponto)), nome);
  };

  return (
    <article
      className={`painel estado-borda-${v.estado} ${focado ? 'focado' : ''} ${arrastandoSobre ? 'alvo-soltar' : ''}`}
      aria-label={`${nome}, ${v.estado}`}
      draggable={arrastavel}
      onDragStart={(ev) => ev.dataTransfer.setData('text/vertice', v.id)}
      onDragOver={(ev) => {
        if (arrastavel) {
          ev.preventDefault();
          setArrastandoSobre(true);
        }
      }}
      onDragLeave={() => setArrastandoSobre(false)}
      onDrop={(ev) => {
        setArrastandoSobre(false);
        const de = ev.dataTransfer.getData('text/vertice');
        if (de) mover(v.sessaoId, de, v.id);
      }}
    >
      <header className="painel-cabeca com-cor-agente" style={{ ['--cor-agente' as string]: cor }} onContextMenu={menu}>
        <MascoteAgente cor={cor} papel={v.papel} tamanho={28} estado={v.estado} entrada={entrada} />
        <div className="painel-nome">
          <span className="painel-nome-linha">
            {renomeando ? (
              <NomeEditavel v={v} editando={renomeando} aoTerminar={() => setRenomeando(false)} />
            ) : (
              <b
                tabIndex={0}
                title="Duplo clique: apelido e cor · F2: renomear aqui · clique direito: opções do agente"
                onDoubleClick={(ev) => abrirEditarAgente(v.id, ev.currentTarget)}
                onKeyDown={(ev) => {
                  if (ev.key === 'F2') setRenomeando(true);
                  if (ev.key === 'Enter') abrirEditarAgente(v.id, ev.currentTarget);
                }}
              >
                {nome}
              </b>
            )}
            {!renomeando && (
              <button className="lapis-agente" title="Apelido e cor" aria-label={`Apelido e cor de ${nome}`} onClick={(ev) => abrirEditarAgente(v.id, ev.currentTarget)}>
                <IconeLapis />
              </button>
            )}
          </span>
          <span className="painel-meta">
            <LogoAgente agente={v.agente} tamanho={13} /> {NOME_AGENTE[v.agente]} · {NOME_NIVEL[v.nivel]}
            {v.worktree && <span className="mono"> · {v.worktree.split('\\').pop()}</span>}
            {lider && <span title={`Criado por ${nomeDoAgente(lider)}`}> · de {nomeDoAgente(lider)}</span>}
          </span>
        </div>
        {v.encerrado ? (
          <span className="estado estado-fechado" title="Fechado" aria-label="Fechado">
            <span className="estado-simbolo" aria-hidden="true">○</span>
            <span className="estado-nome">Fechado</span>
          </span>
        ) : (
          <SimboloEstado estado={v.estado} comNome />
        )}
        {(v.custo > 0 || v.tokens > 0 || v.diff.mais > 0 || v.diff.menos > 0) && (
        <div className="painel-numeros mono" title="Custo, tokens e diff">
          {v.custo > 0 && <span>{formatarCusto(v.custo)}</span>}
          {v.tokens > 0 && <span>{formatarTokens(v.tokens)} tk</span>}
          {(v.diff.mais > 0 || v.diff.menos > 0) && (
            <span>
              <span className="mais">+{v.diff.mais}</span> <span className="menos">−{v.diff.menos}</span>
            </span>
          )}
        </div>
        )}
        <div className="painel-acoes">
          {v.estado === 'trabalhando' && v.agente !== 'terminal' && (
            <button className="icone-botao" title="Interromper (Esc)" onClick={() => interromper(v.id)}>
              <Icone nome="parar" tamanho={14} />
            </button>
          )}
          {v.papel !== 'revisor' && v.agente !== 'terminal' && !corrida && (
            <button className="icone-botao" title="Revisão cruzada: outro agente revisa este, só lendo" onClick={() => revisaoCruzada(v.id)}>
              <Icone nome="revisar" tamanho={14} />
            </button>
          )}
          <button
            className="icone-botao"
            title={focado && e.layout === 'foco' ? 'Voltar para a grade' : 'Focar'}
            onClick={() => {
              if (focado && e.layout === 'foco') definirLayout('auto');
              else {
                focar(v.id);
                definirLayout('foco');
              }
            }}
          >
            <Icone nome="foco" tamanho={14} />
          </button>
          <button className="icone-botao" title="Ocultar (o processo continua rodando)" onClick={() => ocultar(v.id)}>
            <Icone nome="ocultar" tamanho={14} />
          </button>
          {!v.encerrado && (
            <button className="icone-botao perigo" title="Encerrar o processo" onClick={() => setConfirmar(true)}>
              <Icone nome="fechar" tamanho={14} />
            </button>
          )}
        </div>
      </header>

      {confirmar && (
        <div className="faixa faixa-erro">
          <span>Encerrar o processo de {nome}? O histórico do terminal fica salvo.</span>
          <button className="botao perigo pequeno" onClick={() => encerrar(v.id)}>
            Encerrar
          </button>
          <button className="botao pequeno" onClick={() => setConfirmar(false)}>
            Cancelar
          </button>
        </div>
      )}

      {v.estado === 'esperando' && v.pergunta && <FaixaPermissao v={v} nome={nome} />}

      {v.encerrado && (
        <div className="faixa" role="status">
          <span>
            {v.terminalId ? 'O processo terminou.' : 'Fechou junto com o app.'} Abre de novo sem tarefa, esperando você.
          </span>
          <button className="botao primario pequeno" onClick={() => reabrir(v.id)}>
            Abrir de novo
          </button>
        </div>
      )}

      {v.terminalId && <Terminal terminalId={v.terminalId} focado={focado} aoFocar={() => e.focoId !== v.id && focar(v.id)} />}

      {filhos.length > 0 && (
        <footer className="painel-rodape">
          <span>Subagentes:</span>
          {filhos.slice(-4).map((f) => (
            <span key={f.id} className="chip pequeno">
              <SimboloEstado estado={f.estado} /> {nomeDoAgente(f)}
            </span>
          ))}
        </footer>
      )}
    </article>
  );
}

function FaixaPermissao({ v, nome }: { v: Vertice; nome: string }) {
  const d = descreverPedido(v.pergunta!);
  return (
    <div className="faixa faixa-espera" role="alert">
      <span className="estado-simbolo">◆</span>
      <span title={v.pergunta}>
        <b>{nome}</b> {d.acao}
      </span>
      <button className="botao primario pequeno" title={d.dicaSim} onClick={() => responder(v.id, true)}>
        {d.sim}
      </button>
      <button className="botao pequeno" title={d.dicaNao} onClick={() => responder(v.id, false)}>
        {d.nao}
      </button>
    </div>
  );
}

function FaixaCorrida({ e, corridaId }: { e: Estado; corridaId: string }) {
  const c = e.corridas.find((x) => x.id === corridaId)!;
  const vs = c.ids.map((id) => e.vertices.find((v) => v.id === id)).filter(Boolean) as Vertice[];
  const todosProntos = vs.length > 0 && vs.every((v) => v.estado === 'pronto' || v.estado === 'esperando');
  return (
    <div className="faixa faixa-corrida">
      <Icone nome="corrida" />
      <span>
        <b>Corrida:</b> {vs.length} agentes na mesma tarefa: “{c.tarefa}”. {todosProntos ? 'Escolha o melhor:' : 'Esperando todos terminarem…'}
      </span>
      {vs.map((v) => (
        <button key={v.id} className="botao pequeno" disabled={!todosProntos} onClick={() => escolherVencedor(c.id, v.id)} title={`${formatarCusto(v.custo)} · +${v.diff.mais} −${v.diff.menos}`}>
          <SimboloEstado estado={v.estado} /> {nomeDoAgente(v)} <span className="mono">+{v.diff.mais} −{v.diff.menos}</span>
        </button>
      ))}
    </div>
  );
}

const COMANDOS = [
  { nome: '/corrida', argumento: 'tarefa', descricao: 'Vários agentes tentam, você escolhe o melhor' },
  { nome: '/revisar', argumento: '', descricao: 'Outro agente revisa este, só lendo' },
] as const;

function CampoComando({ e, sessaoId, vertices }: { e: Estado; sessaoId: string; vertices: Vertice[] }) {
  const [texto, setTexto] = useState('');
  const focado = vertices.find((v) => v.id === e.focoId);
  const padrao = focado ?? vertices.find((v) => v.papel === 'lider') ?? vertices[0];
  const [alvo, setAlvo] = useState<string>('');
  const alvoId = alvo || padrao?.id || '';
  const alvoV = vertices.find((v) => v.id === alvoId);

  // Menu do clique direito: "Mandar tarefa" e "Mandar para todos" miram o campo e dão o foco.
  const campoRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const f = (ev: Event) => {
      const d = (ev as CustomEvent<{ sessaoId: string; alvo: string }>).detail;
      if (d.sessaoId !== sessaoId) return;
      setAlvo(d.alvo);
      window.setTimeout(() => campoRef.current?.focus(), 30);
    };
    window.addEventListener(EVENTO_CAMPO, f);
    return () => window.removeEventListener(EVENTO_CAMPO, f);
  }, [sessaoId]);

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    const corrida = /^\/corrida(?:\s+(\d))?\s+(.+)$/i.exec(t);
    if (corrida) {
      iniciarCorrida(sessaoId, corrida[2], Number(corrida[1] ?? 3));
    } else if (/^\/revisar\b/i.test(t)) {
      if (alvoV) revisaoCruzada(alvoV.id);
    } else if (t.startsWith('/')) {
      avisar('Comandos: /corrida [2-4] tarefa · /revisar (revisão cruzada do agente escolhido)');
      return;
    } else if (alvoId === 'todos') {
      mandarParaTodos(sessaoId, t);
    } else if (alvoV) {
      if (alvoV.estado === 'esperando' && /^(s|sim|n|não|nao)$/i.test(t)) responder(alvoV.id, /^s/i.test(t));
      else mandar(alvoV.id, t);
    } else {
      abrirDialogo({ tipo: 'novoVertice', sessaoId });
      return;
    }
    setTexto('');
  };

  // Menu de comandos: aparece enquanto a pessoa digita "/" e ainda não pôs espaço.
  const [marcado, setMarcado] = useState(0);
  const [menuFechado, setMenuFechado] = useState(false);
  const busca = /^\/(\S*)$/.exec(texto)?.[1]?.toLowerCase();
  const opcoes = busca === undefined || menuFechado ? [] : COMANDOS.filter((c) => c.nome.slice(1).startsWith(busca));
  const escolher = (c: (typeof COMANDOS)[number]) => {
    setTexto(c.nome + (c.argumento ? ' ' : ''));
    setMarcado(0);
    if (!c.argumento) setMenuFechado(true);
  };

  return (
    <form
      className="comando"
      onSubmit={(ev) => {
        ev.preventDefault();
        const c = opcoes[marcado];
        if (c && (texto.trim() !== c.nome || c.argumento)) return escolher(c);
        enviar();
      }}
    >
      {opcoes.length > 0 && (
        <ul className="comando-menu" role="listbox" aria-label="Comandos">
          {opcoes.map((c, n) => (
            <li key={c.nome} role="option" aria-selected={n === marcado}>
              <button
                type="button"
                className={n === marcado ? 'ativo' : ''}
                onMouseEnter={() => setMarcado(n)}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => escolher(c)}
              >
                <span className="mono">
                  {c.nome}
                  {c.argumento && <span className="secundario"> {c.argumento}</span>}
                </span>
                <span className="secundario">{c.descricao}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="comando-alvo">
        <span>Para</span>
        <select value={alvoId} onChange={(ev) => setAlvo(ev.target.value)} aria-label="Mandar para">
          {vertices.map((v) => (
            <option key={v.id} value={v.id}>
              {nomeDoAgente(v)}
            </option>
          ))}
          {vertices.length > 1 && <option value="todos">Todos os agentes</option>}
        </select>
      </label>
      <input
        ref={campoRef}
        value={texto}
        onChange={(ev) => {
          setTexto(ev.target.value);
          setMarcado(0);
          setMenuFechado(false);
        }}
        onKeyDown={(ev) => {
          if (!opcoes.length) return;
          if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            ev.preventDefault();
            const d = ev.key === 'ArrowDown' ? 1 : -1;
            setMarcado((m) => (m + d + opcoes.length) % opcoes.length);
          } else if (ev.key === 'Tab') {
            ev.preventDefault();
            escolher(opcoes[marcado]);
          } else if (ev.key === 'Escape') {
            setMenuFechado(true);
          }
        }}
        aria-expanded={opcoes.length > 0}
        aria-autocomplete="list"
        placeholder={
          vertices.length === 0
            ? 'Crie um agente para mandar tarefas'
            : alvoId === 'todos'
              ? 'Escreva uma tarefa para todos os agentes…'
              : `Escreva uma tarefa para o ${alvoV ? nomeDoAgente(alvoV) : 'agente'}…  (digite / para ver os comandos)`
        }
        aria-label="Comando"
      />
      <button className="botao primario" type="submit" disabled={!texto.trim()}>
        <Icone nome="enviar" /> Mandar
      </button>
    </form>
  );
}
