// Lateral esquerda: faixa de ícones, busca, árvore de projetos com terminais, Hiper e rodapé.
import { LogoAgente } from './LogoAgente';
import { useState } from 'react';
import {
  abrirDialogo,
  alternarPasta,
  contar,
  corDoAgente,
  definirLayout,
  estadoHiper,
  focar,
  NOME_AGENTE,
  nomeDoAgente,
  selecionarSessao,
  useLoja,
  type Estado,
  type Sessao,
  type Vertice,
} from '../estado/loja';
import { definirModoLateral, irParaRota, listarProjetos, projetoAtivo, useCasca, type ModoLateral, type Projeto, type Rota } from '../estado/casca';
import { FRASE_HIPER, Hiper } from './Hiper';
import { AvatarProjeto, IconeCasca } from './IconesCasca';
import { HiperMini } from './HiperMini';
import { SimboloEstado } from './Pecas';
import { abrirEditarAgente, MascoteAgente } from './EditarAgente';
import { CartaoUsuario } from './Perfil';
import { PilulasDeUso } from './PilulasDeUso';
import { abrirMenu } from './MenuContexto';
import { menuAgente, menuProjeto, menuSessao } from '../estado/menus';

function abrirSessao(id: string, rota: 'sessoes' | 'orquestracao' = 'sessoes') {
  selecionarSessao(id);
  irParaRota(rota);
}

export function BarraLateral() {
  const e = useLoja();
  const rota = e.tela as Rota;
  const casca = useCasca();
  const [busca, setBusca] = useState('');
  const hiper = estadoHiper(e.vertices, e.sucessoAte);
  // Diz quem precisa de atenção, em vez de uma frase genérica.
  const comErro = hiper === 'erro' ? e.vertices.find((v) => v.estado === 'erro') : undefined;
  const esperando = hiper === 'atencao' ? e.vertices.find((v) => v.estado === 'esperando') : undefined;
  const frase = comErro ? `${nomeDoAgente(comErro)} parou com erro.` : esperando ? `${nomeDoAgente(esperando)} precisa de você.` : FRASE_HIPER[hiper];
  const total = contar(e.vertices);
  const recolhida = casca.lateralRecolhida;

  const faixa: { id: string; nome: string; icone: string; ativo: boolean; acao: () => void }[] = [
    { id: 'inicio', nome: 'Início', icone: 'inicio', ativo: rota === 'inicio', acao: () => irParaRota('inicio') },
    {
      id: 'sessoes',
      nome: 'Sessões',
      icone: 'grade',
      ativo: rota !== 'inicio' && casca.modoLateral === 'sessoes',
      acao: () => {
        definirModoLateral('sessoes');
        if (rota === 'inicio' || rota === 'sobre' || rota === 'roteador') irParaRota('sessoes');
      },
    },
    { id: 'arquivos', nome: 'Arquivos', icone: 'pasta', ativo: rota !== 'inicio' && casca.modoLateral === 'arquivos', acao: () => definirModoLateral('arquivos') },
    { id: 'git', nome: 'Git', icone: 'git', ativo: rota !== 'inicio' && casca.modoLateral === 'git', acao: () => definirModoLateral('git') },
  ];

  return (
    <aside className={`lateral ${recolhida ? 'recolhida' : ''}`} aria-label="Barra lateral">
      <div className="faixa-icones" role="toolbar" aria-label="Ir para">
        {faixa.map((f) => (
          <button key={f.id} className={`faixa-botao ${f.ativo ? 'ativo' : ''}`} onClick={f.acao} title={f.nome} aria-label={f.nome} aria-pressed={f.ativo}>
            <IconeCasca nome={f.icone} />
            {f.id === 'sessoes' && total.esperando > 0 && <span className="faixa-selo" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {!recolhida && (
        <>
          <label className="busca">
            <IconeCasca nome="busca" tamanho={15} />
            <input value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar" aria-label="Buscar projetos e terminais" />
            {busca && (
              <button className="busca-limpar" onClick={() => setBusca('')} aria-label="Limpar a busca">
                <IconeCasca nome="fechar" tamanho={12} />
              </button>
            )}
          </label>
          <CorpoLateral e={e} modo={casca.modoLateral} busca={busca.trim().toLowerCase()} />
        </>
      )}
      {recolhida && <div className="lateral-espaco" />}

      <footer className="lateral-rodape">
        <div className={`hiper-rodape hiper-${hiper}`} aria-live="polite" title={frase}>
          <Hiper estado={hiper} tamanho={recolhida ? 30 : 38} />
          {!recolhida && (
            <div className="hiper-texto">
              <div className="hiper-nome">Hiper</div>
              <div className="hiper-frase">{frase}</div>
              {total.esperando > 0 && (
                <div className="hiper-atalho">
                  <kbd>Alt</kbd>+<kbd>N</kbd> vai para quem espera
                </div>
              )}
            </div>
          )}
        </div>

        {!recolhida && (
          <>
            <button
              className="workspace"
              onClick={() => {
                definirLayout('livre');
                irParaRota('sessoes');
              }}
              title="Montar a grade dos terminais do seu jeito"
            >
              <span className="workspace-rotulo">Workspace</span>
              <span className="workspace-ponto">·</span>
              <span>desenhar grid</span>
              <IconeCasca nome="grid" tamanho={13} />
            </button>
          </>
        )}

        <PilulasDeUso compacta={recolhida} />

        <CartaoUsuario recolhida={recolhida}>
          <button className="faixa-botao" onClick={() => irParaRota('sobre')} title="Sobre e ajustes" aria-label="Sobre e ajustes">
            <IconeCasca nome="engrenagem" />
          </button>
        </CartaoUsuario>
      </footer>
    </aside>
  );
}

// ---------- corpo: projetos, arquivos ou git ----------

function CorpoLateral({ e, modo, busca }: { e: Estado; modo: ModoLateral; busca: string }) {
  const projetos = listarProjetos(e);
  const ativo = projetoAtivo(e);

  if (modo === 'arquivos') {
    const p = projetos.find((x) => x.pasta === ativo);
    return (
      <div className="lateral-corpo">
        <div className="lateral-titulo">
          <span>Arquivos</span>
        </div>
        {p ? (
          <div className="lateral-vazio">
            <div className="linha-projeto estatica">
              <AvatarProjeto nome={p.nome} cor={p.cor} />
              <span className="linha-nome">{p.nome}</span>
            </div>
            <p className="mono caminho-pasta">{p.pasta}</p>
            <p>A lista de arquivos do projeto chega junto com o app nativo.</p>
          </div>
        ) : (
          <div className="lateral-vazio">
            <p>Abra um projeto para ver os arquivos dele.</p>
          </div>
        )}
      </div>
    );
  }

  if (modo === 'git') {
    const comWorktree = e.vertices.filter((v) => v.worktree && e.sessoes.find((s) => s.id === v.sessaoId)?.pasta === ativo);
    return (
      <div className="lateral-corpo">
        <div className="lateral-titulo">
          <span>Git · worktrees</span>
        </div>
        {comWorktree.length === 0 ? (
          <div className="lateral-vazio">
            <p>Nenhum agente deste projeto tem worktree próprio ainda.</p>
          </div>
        ) : (
          <ul className="arvore">
            {comWorktree.map((v) => (
              <li key={v.id}>
                <button className="linha-terminal" onClick={() => focar(v.id)} title={v.worktree}>
                  <IconeCasca nome="git" tamanho={14} />
                  <span className="linha-nome">{v.worktree!.split(/[\\/]/).pop()}</span>
                  <span className="diff mono">
                    <span className="mais">+{v.diff.mais}</span> <span className="menos">−{v.diff.menos}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const filtrados = projetos
    .map((p) => filtrarProjeto(e, p, busca))
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="lateral-corpo">
      <div className="lateral-titulo">
        <span>Projetos</span>
        <span className="lateral-titulo-acoes">
          <button onClick={() => abrirDialogo({ tipo: 'modelosBots' })} title="Modelos de bots" aria-label="Modelos de bots">
            <IconeCasca nome="bot" tamanho={15} />
          </button>
          <button onClick={() => abrirDialogo({ tipo: 'novaSessao' })} title="Abrir uma pasta como projeto" aria-label="Abrir uma pasta como projeto">
            <IconeCasca nome="novaPasta" tamanho={15} />
          </button>
          <button
            onClick={() => (e.sessaoAtivaId ? abrirDialogo({ tipo: 'novoVertice', sessaoId: e.sessaoAtivaId }) : abrirDialogo({ tipo: 'novaSessao' }))}
            title="Novo terminal no projeto aberto"
            aria-label="Novo terminal no projeto aberto"
          >
            <IconeCasca nome="mais" tamanho={15} />
          </button>
        </span>
      </div>
      <div className="projetos">
        {filtrados.length === 0 && <div className="lateral-vazio"><p>{busca ? 'Nada encontrado.' : 'Nenhum projeto aberto.'}</p></div>}
        {filtrados.map(({ projeto: p, sessoes }) => (
          <ArvoreProjeto key={p.pasta} e={e} p={p} sessoes={sessoes} busca={busca} />
        ))}
      </div>
    </div>
  );
}

function filtrarProjeto(e: Estado, p: Projeto, busca: string) {
  // Sem busca, quem o Líder criou aparece dentro dele; buscando, todos aparecem soltos.
  const todas = p.sessoes.map((s) => ({
    sessao: s,
    vertices: e.vertices.filter((v) => v.sessaoId === s.id && !v.paiId && (!!busca || !criadoPorLiderVivo(e, v))),
  }));
  if (!busca || p.nome.toLowerCase().includes(busca)) return { projeto: p, sessoes: todas };
  const sessoes = todas
    .map(({ sessao, vertices }) => {
      if (sessao.nome.toLowerCase().includes(busca)) return { sessao, vertices };
      const vs = vertices.filter((v) => nomeDoAgente(v).toLowerCase().includes(busca) || v.nome.toLowerCase().includes(busca) || NOME_AGENTE[v.agente].toLowerCase().includes(busca));
      return vs.length ? { sessao, vertices: vs } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return sessoes.length ? { projeto: p, sessoes } : null;
}

function ArvoreProjeto({
  e,
  p,
  sessoes,
  busca,
}: {
  e: Estado;
  p: Projeto;
  sessoes: { sessao: Sessao; vertices: Vertice[] }[];
  busca: string;
}) {
  const rota = e.tela as Rota;
  const aberta = !!busca || (e.pastasAbertas[p.pasta] ?? true);
  const mostrarOrq = !busca || 'com agentes orquestração'.includes(busca);
  const c = contar(e.vertices.filter((v) => p.sessoes.some((s) => s.id === v.sessaoId)));
  const ativo = projetoAtivo(e) === p.pasta;
  const variasSessoes = p.sessoes.length > 1;

  return (
    <section className="projeto">
      <div className={`linha-projeto ${ativo ? 'ativo' : ''}`}>
        <button
          className="linha-projeto-corpo"
          onContextMenu={(ev) =>
            abrirMenu(
              ev,
              // Projeto com uma sessão só: as opções da sessão vêm junto (não há linha própria dela).
              [...menuProjeto(p.pasta, aberta), ...(p.sessoes.length === 1 ? (['separador', ...menuSessao(p.sessoes[0])] as const) : [])],
              p.nome,
            )
          }
          onClick={() => p.sessoes[0] && abrirSessao(p.sessoes.find((s) => s.id === e.sessaoAtivaId)?.id ?? p.sessoes[0].id)} title={p.pasta}>
          <AvatarProjeto nome={p.nome} cor={p.cor} />
          <span className="linha-nome">{p.nome}</span>
        </button>
        <span className="mini-estados" aria-hidden="true">
          {c.erros > 0 && <SimboloEstado estado="erro" />}
          {c.esperando > 0 && <SimboloEstado estado="esperando" />}
          {c.trabalhando > 0 && <SimboloEstado estado="trabalhando" />}
        </span>
        <button className="linha-acao" onClick={() => alternarPasta(p.pasta)} aria-expanded={aberta} aria-label={aberta ? `Fechar ${p.nome}` : `Abrir ${p.nome}`}>
          <span className={`seta-casca ${aberta ? 'aberta' : ''}`}>
            <IconeCasca nome="baixo" tamanho={14} />
          </span>
        </button>
      </div>

      {aberta && (
        <ul className="arvore">
          {sessoes.map(({ sessao, vertices }) => (
            <li key={sessao.id}>
              {variasSessoes && (
                <button
                  className={`linha-sessao-casca ${e.sessaoAtivaId === sessao.id && rota === 'sessoes' ? 'ativa' : ''}`}
                  onClick={() => abrirSessao(sessao.id)}
                  onContextMenu={(ev) => abrirMenu(ev, menuSessao(sessao), sessao.nome)}
                  title={`${sessao.nome} · clique direito: opções da sessão`}
                >
                  <IconeCasca nome="terminal" tamanho={14} />
                  <span className="linha-nome">{sessao.nome}</span>
                  <span className="contador" title={`${totalDaSessao(e, sessao.id)} terminais`}>
                    {totalDaSessao(e, sessao.id)}
                  </span>
                </button>
              )}
              <ul className={variasSessoes ? 'arvore-sub' : undefined}>
                {vertices.map((v) => (
                  <LinhaTerminal key={v.id} e={e} v={v} nivel={0} aninhar={!busca} />
                ))}
                {mostrarOrq && (
                <li>
                  <button
                    className={`linha-terminal linha-orq ${rota === 'orquestracao' && e.sessaoAtivaId === sessao.id ? 'ativo' : ''}`}
                    onClick={() => abrirSessao(sessao.id, 'orquestracao')}
                  >
                    <IconeCasca nome="orquestracao" tamanho={14} />
                    <span className="linha-nome">Com agentes</span>
                  </button>
                </li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Terminais da sessão, contando os que aparecem dentro do Líder. */
function totalDaSessao(e: Estado, sessaoId: string): number {
  return e.vertices.filter((v) => v.sessaoId === sessaoId && !v.paiId).length;
}

/** O agente foi criado por um Líder que ainda está na sessão. */
function criadoPorLiderVivo(e: Estado, v: Vertice): boolean {
  return !!v.criadoPor && e.vertices.some((x) => x.id === v.criadoPor);
}

function LinhaTerminal({ e, v, nivel, aninhar = true }: { e: Estado; v: Vertice; nivel: number; aninhar?: boolean }) {
  const rota = e.tela as Rota;
  const criados = aninhar ? e.vertices.filter((f) => f.criadoPor === v.id && !f.paiId) : [];
  const filhos = [...criados, ...e.vertices.filter((f) => f.paiId === v.id).slice(-3)];
  const ativo = e.focoId === v.id && rota === 'sessoes';
  const nome = nomeDoAgente(v);
  const cor = corDoAgente(v);
  return (
    <li>
      <button
        className={`linha-terminal com-cor-agente ${ativo ? 'ativo' : ''} ${v.oculto ? 'oculto' : ''}`}
        style={{ ['--cor-agente' as string]: cor, ...(nivel ? { paddingLeft: 12 + nivel * 16 } : {}) }}
        onClick={() => focar(v.id)}
        onContextMenu={(ev) => {
          const ponto = { x: ev.clientX, y: ev.clientY };
          abrirMenu(ev, menuAgente(v, () => abrirEditarAgente(v.id, ponto)), nome);
        }}
        title={`${nome} · ${NOME_AGENTE[v.agente]}${v.oculto ? ' (oculto, ainda rodando)' : ''} · clique direito: opções do agente`}
      >
        {nivel > 0 && <span className="ramo" aria-hidden="true">└</span>}
        <MascoteAgente cor={cor} papel={v.papel} tamanho={14} estado={v.estado} />
        <span className="linha-nome">{nome}</span>
        {nivel === 0 && <LogoAgente agente={v.agente} tamanho={14} className="linha-agente-logo" />}
        {v.encerrado ? (
          <span className="estado estado-fechado" title="Fechado" aria-label="Fechado">
            ○
          </span>
        ) : v.estado === 'trabalhando' ? (
          <HiperMini estado="trabalhando" tamanho={16} rotulo="Trabalhando" />
        ) : (
          <SimboloEstado estado={v.estado} />
        )}
      </button>
      {filhos.length > 0 && (
        <ul>
          {filhos.map((f) => (
            <LinhaTerminal key={f.id} e={e} v={f} nivel={nivel + 1} aninhar={aninhar} />
          ))}
        </ul>
      )}
    </li>
  );
}
