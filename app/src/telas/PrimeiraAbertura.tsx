// Introdução: um cartão por cima do app, em passos (nome, foto, GitHub, tema, agentes).
// Esc não fecha: é o começo. Em dev, `?passo=N` abre direto no passo N (1 em diante).
import { marcarBoasVindasVista } from '../componentes/BoasVindas';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { LogoAgente } from '../componentes/LogoAgente';
import { comecarComExemplo, comecarVazio } from '../estado/loja';
import { nativo, NOME_AGENTE, type AgenteDetectado } from '../nativo';
import { Hiper } from '../componentes/Hiper';
import { Icone } from '../componentes/Pecas';
import { AvatarPerfil, CampoFoto, CampoGitHub } from '../componentes/Perfil';
import { fotoDoGitHub, lerPerfil, salvarPerfil, type Perfil } from '../estado/perfil';

// O seletor de tema é de outro agente; se o arquivo ainda não existe, o passo some.
const modulosTema = import.meta.glob('../componentes/EscolherTema.tsx', { eager: true }) as Record<
  string,
  { EscolherTema?: ComponentType<Record<string, never>> }
>;
const EscolherTema = Object.values(modulosTema)[0]?.EscolherTema;

type Passo = 'nome' | 'foto' | 'github' | 'tema' | 'agentes';

function passoInicial(total: number): number {
  if (!import.meta.env.DEV) return 0;
  const n = Number(new URLSearchParams(window.location.search).get('passo'));
  return Number.isInteger(n) && n >= 1 ? Math.min(n, total) - 1 : 0;
}

export function PrimeiraAbertura() {
  const passos = useMemo<Passo[]>(
    () => ['nome', 'foto', 'github', ...(EscolherTema ? (['tema'] as const) : []), 'agentes'],
    [],
  );
  const [i, setI] = useState(() => passoInicial(passos.length));
  const passo = passos[i];
  const [p, setP] = useState<Perfil>(lerPerfil);
  const muda = (m: Partial<Perfil>) => setP((r) => ({ ...r, ...m }));
  const [buscaGitHub, setBuscaGitHub] = useState(false);

  const [agentes, setAgentes] = useState<AgenteDetectado[] | null>(null);
  const [erroBusca, setErroBusca] = useState(false);
  const procurar = useCallback(() => {
    setAgentes(null);
    setErroBusca(false);
    nativo.processos
      .detectarAgentes()
      .then(setAgentes)
      .catch(() => setErroBusca(true));
  }, []);
  useEffect(procurar, [procurar]);

  const nomeOk = p.nome.trim().length > 0;
  const podeSeguir = passo !== 'nome' || nomeOk;

  const ir = (delta: number) => {
    if (delta > 0 && !podeSeguir) return;
    salvarPerfil(p);
    setI((x) => Math.max(0, Math.min(passos.length - 1, x + delta)));
  };

  const abrirPasta = async () => {
    salvarPerfil(p);
    const pasta = await nativo.arquivos.escolherPasta();
    if (pasta) (marcarBoasVindasVista(), comecarVazio(pasta));
  };

  const confirmarGitHub = async (gh: NonNullable<Perfil['github']>) => {
    muda({ github: gh });
    if (!p.foto || buscaGitHub) muda({ foto: await fotoDoGitHub(gh.avatarUrl) });
    setBuscaGitHub(false);
  };

  const quem = p.nome.trim();
  const estadoHiper = passo === 'agentes' ? (agentes ? 'sucesso' : 'processando') : 'repouso';

  return (
    <div className="primeira-fundo">
      <div className="primeira-cartao pf-intro" role="dialog" aria-labelledby="primeira-titulo">
        <div className="primeira-topo">
          <div className="primeira-hiper">
            <Hiper estado={estadoHiper} tamanho={76} />
            {passo === 'github' && (
              <span className="pf-bv-foto">
                <AvatarPerfil nome={p.nome} foto={p.foto} tamanho={34} />
              </span>
            )}
          </div>
          <div>
            <span className="sobretitulo">
              Passo {i + 1} de {passos.length}
            </span>
            <h1 id="primeira-titulo">
              {passo === 'nome' && 'Oi, eu sou o Hiper.'}
              {passo === 'foto' && (quem ? `Prazer, ${quem}.` : 'Uma foto sua?')}
              {passo === 'github' && 'Usar o seu GitHub?'}
              {passo === 'tema' && 'Escolha um tema'}
              {passo === 'agentes' && 'Seus agentes'}
            </h1>
            <p className="secundario">
              {passo === 'nome' &&
                'Abra aqui os seus agentes de IA, cada um no seu terminal. Eu aviso quando algum precisa de você. Como você quer ser chamado?'}
              {passo === 'foto' && 'Quer pôr uma foto? Ela aparece no seu cartão, na lateral. Dá para pular.'}
              {passo === 'github' && 'Opcional. Traz a sua foto e o seu nome do perfil público do GitHub.'}
              {passo === 'tema' && 'Dá para trocar depois em Sobre e ajustes, na aba Aparência.'}
              {passo === 'agentes' && 'Achei estes no computador. Abra uma pasta de projeto para começar.'}
            </p>
          </div>
        </div>

        <div className="pf-passo">
          {passo === 'nome' && (
            <>
              <label className="pf-rotulo" htmlFor="pf-intro-nome">Seu nome ou apelido</label>
              <input
                id="pf-intro-nome"
                className="pf-campo pf-campo-grande"
                value={p.nome}
                maxLength={40}
                autoFocus
                placeholder="Como você quer ser chamado"
                onChange={(ev) => muda({ nome: ev.target.value })}
                onKeyDown={(ev) => ev.key === 'Enter' && ir(1)}
              />
            </>
          )}

          {passo === 'foto' && (
            <>
              <CampoFoto
                nome={p.nome}
                foto={p.foto}
                github={p.github}
                aoMudar={(foto) => muda({ foto })}
                aoPedirGitHub={() => setBuscaGitHub(true)}
              />
              {buscaGitHub && !p.github && (
                <div className="pf-sub">
                  <span className="pf-rotulo">Usuário do GitHub</span>
                  <CampoGitHub focar github={p.github} aoConfirmar={confirmarGitHub} aoRemover={() => muda({ github: undefined })} />
                </div>
              )}
            </>
          )}

          {passo === 'github' && (
            <>
              <span className="pf-rotulo">Usar meu perfil do GitHub</span>
              <CampoGitHub github={p.github} aoConfirmar={confirmarGitHub} aoRemover={() => muda({ github: undefined })} />
            </>
          )}

          {passo === 'tema' && EscolherTema && <EscolherTema />}

          {passo === 'agentes' && (
            <>
              <div className="detectados">
                <h3>{agentes ? 'Agentes neste computador' : erroBusca ? 'Não consegui procurar os agentes' : 'Procurando agentes instalados…'}</h3>
                {erroBusca && (
                  <p className="detectados-erro">
                    Algo falhou na procura. Dá para tentar de novo ou seguir sem a lista.
                    <button className="botao pequeno" onClick={procurar}>
                      Tentar de novo
                    </button>
                  </p>
                )}
                {agentes && !agentes.some((a) => a.instalado && a.agente !== 'terminal') && (
                  <p className="detectados-erro">
                    Nenhum agente de IA encontrado. Instale o Claude Code, o Codex ou o Gemini e procure de novo.
                    <button className="botao pequeno" onClick={procurar}>
                      Procurar de novo
                    </button>
                  </p>
                )}
                <ul>
                  {(agentes ?? []).map((a) => (
                    <li key={a.agente} className={a.instalado ? '' : 'ausente'}>
                      <span style={{ color: a.instalado ? 'var(--pronto)' : 'var(--texto-2)' }}>{a.instalado ? '●' : '○'}</span>
                      <span className="detectado-nome"><LogoAgente agente={a.agente} tamanho={15} /> {NOME_AGENTE[a.agente]}</span>
                      <span className="mono secundario">{a.instalado ? `${a.comando} ${a.versao ?? ''}` : 'não encontrado'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="primeira-acoes">
                <button className="botao primario" onClick={abrirPasta} disabled={!agentes && !erroBusca}>
                  <Icone nome="pasta" /> Abrir uma pasta de projeto
                </button>
                <button
                  className="botao"
                  onClick={() => {
                    salvarPerfil(p);
                    (marcarBoasVindasVista(), comecarComExemplo());
                  }}
                  disabled={!agentes && !erroBusca}
                >
                  Explorar com um exemplo
                </button>
              </div>
            </>
          )}
        </div>

        <div className="pf-navegacao">
          <div className="pf-bolinhas" aria-label={`Passo ${i + 1} de ${passos.length}`} role="img">
            {passos.map((x, n) => (
              <span key={x} className={n === i ? 'atual' : n < i ? 'feita' : ''} />
            ))}
          </div>
          <div className="pf-nav-botoes">
            {i > 0 && (
              <button className="botao" onClick={() => ir(-1)}>
                Voltar
              </button>
            )}
            {(passo === 'foto' || passo === 'github') && (
              <button className="botao pf-link" onClick={() => ir(1)}>
                Pular
              </button>
            )}
            {passo !== 'agentes' && (
              <button className="botao primario" onClick={() => ir(1)} disabled={!podeSeguir}>
                Continuar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
