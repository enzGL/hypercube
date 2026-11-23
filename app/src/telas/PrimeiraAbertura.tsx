// Introdução: um cartão por cima do app, em passos (nome, foto, GitHub, tema, agentes).
// Esc não fecha: é o começo. Em dev, `?passo=N` abre direto no passo N (1 em diante).
import { INSTALACAO, aoTerminarInstalacao } from '../estado/instalacao';
import { InstalarAgente } from '../componentes/InstalarAgente';
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
  const procurar = useCallback((novo = false) => {
    setAgentes(null);
    setErroBusca(false);
    nativo.processos
      .detectarAgentes(novo)
      .then(setAgentes)
      .catch(() => setErroBusca(true));
  }, []);
  useEffect(() => procurar(), [procurar]);
  // Quando uma instalação termina, a lista se atualiza sem piscar "procurando".
  useEffect(() => aoTerminarInstalacao(() => nativo.processos.detectarAgentes(true).then(setAgentes)), []);

  const instaladas = (agentes ?? []).filter((a) => a.instalado && a.agente !== 'terminal');
  const faltando = (agentes ?? []).filter((a) => !a.instalado && INSTALACAO[a.agente]);

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
                'Eu organizo os seus agentes de IA e aviso quando algum precisa de você. Como devo te chamar?'}
              {passo === 'foto' && 'Quer pôr uma foto? Ela aparece na lateral. Dá para pular.'}
              {passo === 'github' && 'Opcional. Traz a sua foto e o seu nome.'}
              {passo === 'tema' && 'Dá para trocar depois.'}
              {passo === 'agentes' && 'Estes eu achei no seu computador.'}
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
              <div className="ia-passo">
                {!agentes && !erroBusca && <p className="ia-procurando">Procurando os agentes do computador…</p>}
                {erroBusca && (
                  <div className="ia-aviso">
                    <span>Não consegui procurar.</span>
                    <button className="botao" onClick={() => procurar(true)}>
                      Tentar de novo
                    </button>
                  </div>
                )}
                {agentes && (
                  <>
                    <h3 className="ia-titulo">Instalados</h3>
                    {instaladas.length === 0 ? (
                      <div className="ia-aviso">
                        <span>Nenhum agente encontrado.</span>
                      </div>
                    ) : (
                      <ul className="ia-grade">
                        {instaladas.map((a) => (
                          <li key={a.agente} className="ia-cartao ia-instalada" title={`${a.comando} ${a.versao ?? ''}`}>
                            <LogoAgente agente={a.agente} tamanho={28} />
                            <b>{NOME_AGENTE[a.agente]}</b>
                            <span className="ia-ok" aria-label="Instalado">✓</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {faltando.length > 0 && (
                      <>
                        <h3 className="ia-titulo">Vale instalar</h3>
                        <ul className="ia-grade">
                          {faltando.map((a) => {
                            const s = INSTALACAO[a.agente]!;
                            return (
                              <li key={a.agente} className="ia-cartao ia-sugerida">
                                <LogoAgente agente={a.agente} tamanho={28} />
                                <span className="ia-texto">
                                  <b>{NOME_AGENTE[a.agente]}</b>
                                  <span>{s.desc}</span>
                                </span>
                                <InstalarAgente agente={a.agente} />
                              </li>
                            );
                          })}
                        </ul>
                        <button className="botao ia-procurar" onClick={() => procurar(true)}>
                          Já instalei, procurar de novo
                        </button>
                      </>
                    )}
                  </>
                )}
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
