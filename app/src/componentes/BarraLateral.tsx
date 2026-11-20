import {
  abrirDialogo,
  alternarPasta,
  contar,
  estadoHiper,
  focar,
  irPara,
  selecionarSessao,
  useLoja,
  type Tela,
  type Vertice,
} from '../estado/loja';
import { nativo } from '../nativo';
import { FRASE_HIPER, Hiper } from './Hiper';
import { Icone, MiniVertice, SimboloEstado } from './Pecas';

const NAV: { tela: Tela; nome: string; icone: string }[] = [
  { tela: 'sessoes', nome: 'Sessões', icone: 'sessoes' },
  { tela: 'orquestracao', nome: 'Orquestração', icone: 'orquestracao' },
  { tela: 'imagens', nome: 'Imagens', icone: 'imagens' },
  { tela: 'roteador', nome: 'Roteador', icone: 'roteador' },
];

const REPO = 'https://github.com/enzGL/hypercube';

export function BarraLateral() {
  const e = useLoja();
  const hiper = estadoHiper(e.vertices, e.sucessoAte);
  const total = contar(e.vertices);

  const pastas = new Map<string, typeof e.sessoes>();
  e.sessoes.forEach((s) => pastas.set(s.pasta, [...(pastas.get(s.pasta) ?? []), s]));

  const linhaVertice = (v: Vertice, nivel: number) => (
    <li key={v.id}>
      <button
        className={`linha-vertice ${e.focoId === v.id ? 'ativo' : ''} ${v.oculto ? 'oculto' : ''}`}
        style={{ paddingLeft: 30 + nivel * 14 }}
        onClick={() => focar(v.id)}
        title={v.oculto ? `${v.nome} (oculto, ainda rodando)` : v.nome}
      >
        {nivel > 0 && <span className="ramo" aria-hidden="true">└</span>}
        <MiniVertice papel={v.papel} tamanho={14} estado={v.estado} />
        <span className="linha-nome">{v.nome}</span>
        {v.oculto && <Icone nome="ocultar" tamanho={12} />}
        <SimboloEstado estado={v.estado} />
      </button>
      {e.vertices.filter((f) => f.paiId === v.id).length > 0 && (
        <ul>{e.vertices.filter((f) => f.paiId === v.id).slice(-3).map((f) => linhaVertice(f, nivel + 1))}</ul>
      )}
    </li>
  );

  return (
    <aside className="lateral" aria-label="Barra lateral">
      <div className="lateral-topo">
        <img className="logo" src="./logo-hypercube.png" alt="" width={26} height={26} />
        <span className="marca">Hypercube</span>
        <span className="versao">0.1</span>
      </div>

      <div className={`cartao-hiper hiper-${hiper}`} aria-live="polite">
        <Hiper estado={hiper} tamanho={58} />
        <div>
          <div className="hiper-nome">Hiper</div>
          <div className="hiper-frase">{FRASE_HIPER[hiper]}</div>
          {total.esperando > 0 && (
            <div className="hiper-atalho">
              <kbd>Alt</kbd>+<kbd>N</kbd> vai para quem espera
            </div>
          )}
        </div>
      </div>

      <nav className="nav" aria-label="Telas">
        {NAV.map((n) => (
          <button key={n.tela} className={`nav-item ${e.tela === n.tela ? 'ativo' : ''}`} onClick={() => irPara(n.tela)} aria-current={e.tela === n.tela ? 'page' : undefined}>
            <Icone nome={n.icone} />
            <span>{n.nome}</span>
            {n.tela === 'sessoes' && total.esperando > 0 && <span className="selo selo-esperando">◆ {total.esperando}</span>}
          </button>
        ))}
      </nav>

      <div className="lateral-titulo">
        <span>Projetos</span>
      </div>
      <div className="projetos">
        {[...pastas.entries()].map(([pasta, sessoes]) => {
          const aberta = e.pastasAbertas[pasta] ?? true;
          const nomePasta = pasta.split(/[\\/]/).filter(Boolean).pop();
          return (
            <section key={pasta} className="pasta">
              <button className="pasta-cabeca" onClick={() => alternarPasta(pasta)} aria-expanded={aberta} title={pasta}>
                <span className={`seta ${aberta ? 'aberta' : ''}`}>
                  <Icone nome="seta" tamanho={12} />
                </span>
                <Icone nome="pasta" tamanho={14} />
                <span className="pasta-nome">{nomePasta}</span>
              </button>
              {aberta && (
                <ul className="sessoes-lista">
                  {sessoes.map((s) => {
                    const vs = e.vertices.filter((v) => v.sessaoId === s.id);
                    const c = contar(vs);
                    const ativa = e.sessaoAtivaId === s.id;
                    return (
                      <li key={s.id}>
                        <button className={`linha-sessao ${ativa ? 'ativa' : ''}`} onClick={() => selecionarSessao(s.id)}>
                          <span className="linha-nome">{s.nome}</span>
                          <span className="mini-estados" aria-hidden="true">
                            {c.erros > 0 && <SimboloEstado estado="erro" />}
                            {c.esperando > 0 && <SimboloEstado estado="esperando" />}
                            {c.trabalhando > 0 && <SimboloEstado estado="trabalhando" />}
                          </span>
                          <span className="contador" title={`${c.agentes} Vértices`}>
                            {c.agentes}
                          </span>
                        </button>
                        {ativa && vs.length > 0 && <ul>{vs.filter((v) => !v.paiId).map((v) => linhaVertice(v, 0))}</ul>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <button className="botao-nova" onClick={() => abrirDialogo({ tipo: 'novaSessao' })}>
        <Icone nome="mais" /> Nova sessão
      </button>

      <footer className="lateral-rodape">
        <p>É grátis para usar. Só pedimos que você dê uma estrela no GitHub!</p>
        <div className="rodape-acoes">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            onClick={(ev) => {
              if (nativo.modo === 'tauri') {
                ev.preventDefault();
                nativo.sistema.abrirLink(REPO);
              }
            }}
          >
            <Icone nome="estrela" tamanho={14} /> Dar estrela
          </a>
          <button className={`link ${e.tela === 'sobre' ? 'ativo' : ''}`} onClick={() => irPara('sobre')}>
            Sobre
          </button>
        </div>
      </footer>
    </aside>
  );
}
