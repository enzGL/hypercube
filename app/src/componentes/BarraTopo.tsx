// Barra de cima do app (abas de projeto, navegação, uso dos agentes, RAM) e o cabeçalho de cada tela.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ControlesJanela, alternarMaximizar } from './ControlesJanela';
import { abrirDialogo, contar, selecionarSessao, useLoja, verticesDaSessao } from '../estado/loja';
import {
  abrirAba,
  alternarLateral,
  alternarPainel,
  avancar,
  fecharAbaProjeto,
  irParaRota,
  listarProjetos,
  podeAvancar,
  podeVoltar,
  projetoAtivo,
  reabrirAbaProjeto,
  registrarPasso,
  useCasca,
  voltar,
  type Projeto,
  type Rota,
} from '../estado/casca';
import { AvatarProjeto, IconeCasca } from './IconesCasca';
import { SimboloEstado } from './Pecas';

interface PropsCabecalho {
  titulo: string;
  subtitulo?: string;
  acoes?: ReactNode;
}

/**
 * Sem props: a barra de cima do app (usada pelo App).
 * Com `titulo`: o cabeçalho compacto da tela (as telas já chamam assim).
 */
export function BarraTopo(props: Partial<PropsCabecalho>) {
  if (props.titulo !== undefined) return <CabecalhoTela titulo={props.titulo} subtitulo={props.subtitulo} acoes={props.acoes} />;
  return <BarraGlobal />;
}

// ---------- cabeçalho da tela ----------

export function CabecalhoTela({ titulo, subtitulo, acoes }: PropsCabecalho) {
  const e = useLoja();
  const c = contar(e.sessaoAtivaId ? verticesDaSessao(e, e.sessaoAtivaId) : e.vertices);
  return (
    <header className="topo">
      <div className="topo-linha">
        <div className="topo-titulo">
          <h1 title={titulo}>{titulo}</h1>
          {subtitulo && <span className="caminho">{subtitulo}</span>}
        </div>
        <div className="contadores" role="status" aria-label="Estado dos agentes desta sessão">
          <span className="contador-item">
            <b>{c.agentes}</b> {c.agentes === 1 ? 'agente' : 'agentes'}
          </span>
          <span className="contador-item" title="Trabalhando">
            <SimboloEstado estado="trabalhando" /> <b>{c.trabalhando}</b>
          </span>
          <span className="contador-item" title="Esperando você">
            <SimboloEstado estado="esperando" /> <b>{c.esperando}</b>
          </span>
          <span className="contador-item" title="Prontos">
            <SimboloEstado estado="pronto" /> <b>{c.prontos}</b>
          </span>
          {c.erros > 0 && (
            <span className="contador-item" title="Com erro">
              <SimboloEstado estado="erro" /> <b>{c.erros}</b>
            </span>
          )}
        </div>
        {acoes && <div className="topo-acoes">{acoes}</div>}
      </div>
    </header>
  );
}

// ---------- barra global ----------

const MENU: { rota: Rota; nome: string; icone: string }[] = [
  { rota: 'inicio', nome: 'Início', icone: 'inicio' },
  { rota: 'sessoes', nome: 'Sessões', icone: 'grade' },
  { rota: 'orquestracao', nome: 'Orquestração', icone: 'orquestracao' },
  { rota: 'imagens', nome: 'Imagens', icone: 'imagens' },
  { rota: 'roteador', nome: 'Roteador', icone: 'roteador' },
  { rota: 'sobre', nome: 'Sobre', icone: 'sobre' },
];

function BarraGlobal() {
  const e = useLoja();
  const rota = e.tela as Rota;
  const casca = useCasca();
  const [menu, setMenu] = useState(false);
  const refMenu = useRef<HTMLDivElement>(null);
  const ultimaSessao = useRef<Record<string, string>>({});
  const ativo = projetoAtivo(e);

  useEffect(() => {
    registrarPasso(rota, e.sessaoAtivaId);
    if (ativo && e.sessaoAtivaId) ultimaSessao.current[ativo] = e.sessaoAtivaId;
  }, [rota, e.sessaoAtivaId, ativo]);

  // Escolheu pela lateral um projeto cuja aba estava fechada: a aba volta.
  useEffect(() => {
    if (ativo && rota !== 'inicio' && casca.abasFechadas.includes(ativo)) reabrirAbaProjeto(ativo);
  }, [ativo, rota, casca.abasFechadas]);

  useEffect(() => {
    if (!menu) return;
    const fora = (ev: MouseEvent) => {
      if (!refMenu.current?.contains(ev.target as Node)) setMenu(false);
    };
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && setMenu(false);
    window.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', fora);
      window.removeEventListener('keydown', esc);
    };
  }, [menu]);

  const projetos = listarProjetos(e).filter((p) => !casca.abasFechadas.includes(p.pasta));

  const abrirProjeto = (p: Projeto) => {
    const lembrada = ultimaSessao.current[p.pasta];
    const sessao = p.sessoes.find((s) => s.id === lembrada) ?? p.sessoes[0];
    if (!sessao) return;
    selecionarSessao(sessao.id);
    if (rota !== 'sessoes' && rota !== 'orquestracao' && rota !== 'imagens') irParaRota('sessoes');
  };

  const fecharProjeto = (p: Projeto) => {
    const resto = projetos.filter((x) => x.pasta !== p.pasta);
    fecharAbaProjeto(p.pasta);
    if (resto[0]) abrirProjeto(resto[0]);
    else irParaRota('inicio');
  };

  return (
    <header
      className="barra-global"
      data-tauri-drag-region
      onDoubleClick={(ev) => {
        if ((ev.target as HTMLElement).hasAttribute('data-tauri-drag-region')) alternarMaximizar();
      }}
    >
      <div className="bg-grupo" ref={refMenu}>
        <button className={`bg-botao bg-logo ${menu ? 'ligado' : ''}`} onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu} title="Menu">
          <img className="logo" src="./logo-hypercube.png" alt="" width={18} height={18} />
          <IconeCasca nome="baixo" tamanho={11} />
        </button>
        {menu && (
          <div className="bg-menu" role="menu">
            {MENU.map((m) => (
              <button
                key={m.rota}
                role="menuitem"
                className={rota === m.rota ? 'ativo' : ''}
                onClick={() => {
                  irParaRota(m.rota);
                  setMenu(false);
                }}
              >
                <IconeCasca nome={m.icone} /> {m.nome}
              </button>
            ))}
            <hr />
            <button
              role="menuitem"
              onClick={() => {
                abrirDialogo({ tipo: 'novaSessao' });
                setMenu(false);
              }}
            >
              <IconeCasca nome="mais" /> Nova sessão
            </button>
          </div>
        )}
        <button className={`bg-botao ${casca.lateralRecolhida ? '' : 'ligado'}`} onClick={alternarLateral} title={casca.lateralRecolhida ? 'Mostrar a lateral' : 'Recolher a lateral'} aria-label="Recolher a lateral">
          <IconeCasca nome="lateral" />
        </button>
        <button className="bg-botao" onClick={voltar} disabled={!podeVoltar()} title="Voltar" aria-label="Voltar">
          <IconeCasca nome="voltar" />
        </button>
        <button className="bg-botao" onClick={avancar} disabled={!podeAvancar()} title="Avançar" aria-label="Avançar">
          <IconeCasca nome="avancar" />
        </button>
      </div>

      <nav className="bg-abas" aria-label="Projetos abertos" data-tauri-drag-region>
        {projetos.map((p) => {
          const ativa = p.pasta === ativo && rota !== 'inicio';
          const c = contar(e.vertices.filter((v) => p.sessoes.some((s) => s.id === v.sessaoId)));
          return (
            <div key={p.pasta} className={`bg-aba ${ativa ? 'ativa' : ''}`} title={p.pasta}>
              <button className="bg-aba-corpo" onClick={() => abrirProjeto(p)} aria-current={ativa ? 'page' : undefined}>
                <AvatarProjeto nome={p.nome} cor={p.cor} tamanho={16} />
                <span className="bg-aba-nome">{p.nome}</span>
                {p.sessoes.length > 1 && <span className="bg-aba-extra">+ {p.sessoes.length - 1}</span>}
                <span
                  className={`bg-aba-contador ${c.erros > 0 ? 'com-erro' : c.esperando > 0 ? 'com-espera' : ''}`}
                  title={`${p.terminais} terminais${c.erros > 0 ? ` · ${c.erros} com erro` : c.esperando > 0 ? ` · ${c.esperando} esperando você` : ''}`}
                >
                  {c.erros > 0 ? <SimboloEstado estado="erro" /> : c.esperando > 0 ? <SimboloEstado estado="esperando" /> : null}
                  {p.terminais}
                </span>
              </button>
              {ativa && (
                <button className="bg-aba-fechar" onClick={() => fecharProjeto(p)} aria-label={`Fechar a aba ${p.nome}`} title="Fechar a aba (os terminais continuam rodando)">
                  <IconeCasca nome="fechar" tamanho={12} />
                </button>
              )}
            </div>
          );
        })}
        <button className="bg-botao bg-nova-aba" onClick={() => abrirDialogo({ tipo: 'novaSessao' })} title="Novo projeto" aria-label="Novo projeto">
          <IconeCasca nome="mais" tamanho={14} />
        </button>
      </nav>

      <div className="bg-grupo bg-direita">
        <button className={`bg-botao ${casca.painelAberto && casca.aba === 'notas' ? 'ligado' : ''}`} onClick={() => abrirAba('notas')} title="Notas do projeto" aria-label="Notas do projeto">
          <IconeCasca nome="notas" />
        </button>
        <button className={`bg-botao ${casca.painelAberto ? 'ligado' : ''}`} onClick={alternarPainel} title={casca.painelAberto ? 'Esconder o painel direito' : 'Mostrar o painel direito'} aria-label="Painel direito">
          <IconeCasca nome="painelDireito" />
        </button>
      </div>
      <ControlesJanela />
    </header>
  );
}
