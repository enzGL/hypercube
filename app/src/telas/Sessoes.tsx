import { useState } from 'react';
import {
  abrirDialogo,
  definirColunas,
  definirLayout,
  encerrar,
  escolherVencedor,
  focar,
  iniciarCorrida,
  interromper,
  mandar,
  mandarParaTodos,
  mover,
  NOME_AGENTE,
  NOME_NIVEL,
  ocultar,
  ordenados,
  responder,
  revisaoCruzada,
  avisar,
  useLoja,
  type Estado,
  type Layout,
  type Vertice,
} from '../estado/loja';
import { BarraTopo } from '../componentes/BarraTopo';
import { Hiper } from '../componentes/Hiper';
import { formatarCusto, formatarTokens, Icone, MiniVertice, SimboloEstado } from '../componentes/Pecas';
import { Terminal } from '../componentes/Terminal';

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
  const corrida = e.corridas.find((c) => c.sessaoId === sessao.id && !c.escolhido && c.ids.length > 0);

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
      <button className="botao primario" onClick={() => abrirDialogo({ tipo: 'novoVertice', sessaoId: sessao.id })}>
        <Icone nome="mais" /> Vértice
      </button>
    </>
  );

  return (
    <div className="tela-sessoes">
      <BarraTopo titulo={sessao.nome} subtitulo={sessao.pasta + (sessao.worktrees ? '  ·  um worktree por Vértice' : '')} acoes={todos.length ? acoes : undefined} />

      {corrida && <FaixaCorrida e={e} corridaId={corrida.id} />}

      {todos.length === 0 ? (
        <div className="vazio">
          <Hiper estado="repouso" tamanho={150} />
          <h2>Nenhum Vértice nesta sessão</h2>
          <p>Um Vértice é um agente com um papel: líder, batedor, construtor ou revisor. Cada um ganha o seu terminal.</p>
          <div className="vazio-acoes">
            <button className="botao primario" onClick={() => abrirDialogo({ tipo: 'novoVertice', sessaoId: sessao.id, papel: 'lider' })}>
              <Icone nome="mais" /> Criar Vértice
            </button>
          </div>
        </div>
      ) : (
        <>
          {ocultos.length > 0 && (
            <div className="faixa-ocultos">
              <Icone nome="ocultar" tamanho={14} />
              <span>
                {ocultos.length} {ocultos.length === 1 ? 'oculto' : 'ocultos'} (continuam rodando):
              </span>
              {ocultos.map((v) => (
                <button key={v.id} className="chip" onClick={() => ocultar(v.id, false)}>
                  <SimboloEstado estado={v.estado} /> {v.nome} <Icone nome="olho" tamanho={12} />
                </button>
              ))}
            </div>
          )}
          {visiveis.length === 0 ? (
            <div className="vazio pequeno">
              <Hiper estado="repouso" tamanho={90} />
              <p>Todos os Vértices estão ocultos. Eles continuam rodando.</p>
            </div>
          ) : e.layout === 'foco' ? (
            <LayoutFoco e={e} visiveis={visiveis} />
          ) : (
            <div
              className="grade"
              style={{ gridTemplateColumns: `repeat(${e.layout === 'livre' ? e.colunasLivres : colunasAuto(visiveis.length)}, minmax(0, 1fr))` }}
            >
              {visiveis.map((v) => (
                <Painel key={v.id} v={v} e={e} arrastavel={e.layout === 'livre'} />
              ))}
            </div>
          )}
        </>
      )}

      <CampoComando e={e} sessaoId={sessao.id} vertices={todos} />
    </div>
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
                <MiniVertice papel={v.papel} tamanho={18} estado={v.estado} />
                <b>{v.nome}</b>
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
  const focado = e.focoId === v.id;
  const filhos = e.vertices.filter((f) => f.paiId === v.id);
  const corrida = v.corridaId ? e.corridas.find((c) => c.id === v.corridaId) : undefined;

  return (
    <article
      className={`painel estado-borda-${v.estado} ${focado ? 'focado' : ''} ${arrastandoSobre ? 'alvo-soltar' : ''}`}
      aria-label={`${v.nome}, ${v.estado}`}
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
      <header className="painel-cabeca">
        <MiniVertice papel={v.papel} tamanho={20} estado={v.estado} />
        <div className="painel-nome">
          <b>{v.nome}</b>
          <span className="painel-meta">
            {NOME_AGENTE[v.agente]} · {NOME_NIVEL[v.nivel]}
            {v.worktree && <span className="mono"> · {v.worktree.split('\\').pop()}</span>}
          </span>
        </div>
        <SimboloEstado estado={v.estado} comNome />
        <div className="painel-numeros mono" title="Custo, tokens e diff">
          <span>{formatarCusto(v.custo)}</span>
          <span>{formatarTokens(v.tokens)} tk</span>
          {(v.diff.mais > 0 || v.diff.menos > 0) && (
            <span>
              <span className="mais">+{v.diff.mais}</span> <span className="menos">−{v.diff.menos}</span>
            </span>
          )}
        </div>
        <div className="painel-acoes">
          {v.estado === 'trabalhando' && v.agente !== 'terminal' && (
            <button className="icone-botao" title="Interromper (Esc)" onClick={() => interromper(v.id)}>
              <Icone nome="parar" tamanho={14} />
            </button>
          )}
          {v.papel !== 'revisor' && v.agente !== 'terminal' && !corrida && (
            <button className="icone-botao" title="Revisão cruzada: outro Vértice revisa este, só lendo" onClick={() => revisaoCruzada(v.id)}>
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
          <button className="icone-botao perigo" title="Encerrar o processo" onClick={() => setConfirmar(true)}>
            <Icone nome="fechar" tamanho={14} />
          </button>
        </div>
      </header>

      {confirmar && (
        <div className="faixa faixa-erro">
          <span>Encerrar o processo de {v.nome}? O histórico do terminal fica salvo.</span>
          <button className="botao perigo pequeno" onClick={() => encerrar(v.id)}>
            Encerrar
          </button>
          <button className="botao pequeno" onClick={() => setConfirmar(false)}>
            Cancelar
          </button>
        </div>
      )}

      {v.estado === 'esperando' && v.pergunta && (
        <div className="faixa faixa-espera" role="alert">
          <span className="estado-simbolo">◆</span>
          <span>
            <b>{v.nome} pede permissão:</b> {v.pergunta}
          </span>
          <button className="botao primario pequeno" onClick={() => responder(v.id, true)}>
            Permitir
          </button>
          <button className="botao pequeno" onClick={() => responder(v.id, false)}>
            Negar
          </button>
        </div>
      )}

      {v.terminalId && <Terminal terminalId={v.terminalId} focado={focado} aoFocar={() => e.focoId !== v.id && focar(v.id)} />}

      {filhos.length > 0 && (
        <footer className="painel-rodape">
          <span>Subagentes:</span>
          {filhos.slice(-4).map((f) => (
            <span key={f.id} className="chip pequeno">
              <SimboloEstado estado={f.estado} /> {f.nome}
            </span>
          ))}
        </footer>
      )}
    </article>
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
        <b>Corrida:</b> {vs.length} Vértices na mesma tarefa: “{c.tarefa}”. {todosProntos ? 'Escolha o melhor:' : 'Esperando todos terminarem…'}
      </span>
      {vs.map((v) => (
        <button key={v.id} className="botao pequeno" disabled={!todosProntos} onClick={() => escolherVencedor(c.id, v.id)} title={`${formatarCusto(v.custo)} · +${v.diff.mais} −${v.diff.menos}`}>
          <SimboloEstado estado={v.estado} /> {v.nome} <span className="mono">+{v.diff.mais} −{v.diff.menos}</span>
        </button>
      ))}
    </div>
  );
}

function CampoComando({ e, sessaoId, vertices }: { e: Estado; sessaoId: string; vertices: Vertice[] }) {
  const [texto, setTexto] = useState('');
  const focado = vertices.find((v) => v.id === e.focoId);
  const padrao = focado ?? vertices.find((v) => v.papel === 'lider') ?? vertices[0];
  const [alvo, setAlvo] = useState<string>('');
  const alvoId = alvo || padrao?.id || '';
  const alvoV = vertices.find((v) => v.id === alvoId);

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    const corrida = /^\/corrida(?:\s+(\d))?\s+(.+)$/i.exec(t);
    if (corrida) {
      iniciarCorrida(sessaoId, corrida[2], Number(corrida[1] ?? 3));
    } else if (/^\/revisar\b/i.test(t)) {
      if (alvoV) revisaoCruzada(alvoV.id);
    } else if (t.startsWith('/')) {
      avisar('Comandos: /corrida [2-4] tarefa · /revisar (revisão cruzada do Vértice escolhido)');
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

  return (
    <form
      className="comando"
      onSubmit={(ev) => {
        ev.preventDefault();
        enviar();
      }}
    >
      <label className="comando-alvo">
        <span>Para</span>
        <select value={alvoId} onChange={(ev) => setAlvo(ev.target.value)} aria-label="Mandar para">
          {vertices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}
            </option>
          ))}
          {vertices.length > 1 && <option value="todos">Todos os Vértices</option>}
        </select>
      </label>
      <input
        value={texto}
        onChange={(ev) => setTexto(ev.target.value)}
        placeholder={
          vertices.length === 0
            ? 'Crie um Vértice para mandar tarefas'
            : alvoId === 'todos'
              ? 'Escreva uma tarefa para todos os Vértices…'
              : `Escreva uma tarefa para o ${alvoV?.nome ?? 'Vértice'}…  (/corrida, /revisar)`
        }
        aria-label="Comando"
      />
      <button className="botao primario" type="submit" disabled={!texto.trim()}>
        <Icone nome="enviar" /> Mandar
      </button>
    </form>
  );
}
