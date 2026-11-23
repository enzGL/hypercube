// Botão "Instalar" de um agente que falta, com o comando à vista para copiar e o terminal da instalação.
import { useEffect, useState } from 'react';
import { aoTerminarInstalacao, INSTALACAO, instalarAgente, SITE_NODE, useInstalacao } from '../estado/instalacao';
import { nativo, NOME_AGENTE, type Agente, type AgenteDetectado } from '../nativo';
import { LogoAgente } from './LogoAgente';
import { Terminal } from './Terminal';

/** Lista de agentes que se atualiza sozinha quando uma instalação termina. */
export function useAgentesDetectados(): AgenteDetectado[] {
  const [a, setA] = useState<AgenteDetectado[]>([]);
  useEffect(() => {
    nativo.processos.detectarAgentes().then(setA);
    return aoTerminarInstalacao(() => nativo.processos.detectarAgentes().then(setA));
  }, []);
  return a;
}

/** Ações de instalação de um agente: Instalar, comando para copiar e site. `compacto` para linhas de diálogo. */
export function InstalarAgente({ agente, compacto = false }: { agente: Agente; compacto?: boolean }) {
  const info = INSTALACAO[agente];
  const est = useInstalacao()[agente];
  const [copiado, setCopiado] = useState(false);
  if (!info) return null;
  const copiar = () => {
    if (!info.comando) return;
    navigator.clipboard?.writeText(info.comando).then(
      () => {
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 1500);
      },
      () => {},
    );
  };
  const site = (
    <button className="botao pequeno" onClick={() => nativo.sistema.abrirLink(info.site)} title={info.site}>
      {info.comando ? 'Site' : 'Site oficial'}
    </button>
  );

  if (est?.fase === 'instalado') return <span className="inst-ok">Instalado ✓</span>;

  return (
    <div className={`inst ${compacto ? 'inst-compacto' : ''}`}>
      <div className="inst-acoes">
        {info.comando ? (
          est?.fase === 'instalando' ? (
            <span className="inst-andando" role="status">
              Instalando…
            </span>
          ) : (
            <button className="botao primario pequeno" onClick={() => instalarAgente(agente)} title={`Roda ${info.comando} num terminal do Hypercube`}>
              {est?.fase === 'erro' || est?.fase === 'sem-node' ? 'Tentar de novo' : 'Instalar'}
            </button>
          )
        ) : null}
        {info.comando && (
          <button className="botao pequeno" onClick={copiar} title={info.comando}>
            {copiado ? 'Copiado ✓' : 'Copiar comando'}
          </button>
        )}
        {site}
      </div>
      {info.comando && !compacto && <code className="inst-comando mono">{info.comando}</code>}
      {!info.comando && <span className="inst-nota">{NOME_AGENTE[agente]} não se instala pelo npm: baixe no site oficial.</span>}
      {est?.fase === 'sem-node' && (
        <div className="inst-aviso" role="alert">
          <span>Para instalar, o computador precisa do Node.js (ele traz o npm).</span>
          <button className="botao pequeno" onClick={() => nativo.sistema.abrirLink(SITE_NODE)}>
            Baixar o Node.js
          </button>
        </div>
      )}
      {est?.fase === 'erro' && (
        <p className="inst-erro" role="alert">
          {est.mensagem}
        </p>
      )}
      {(est?.fase === 'instalando' || est?.fase === 'erro') && est.terminalId && (
        <div className="inst-terminal">
          <Terminal terminalId={est.terminalId} />
        </div>
      )}
    </div>
  );
}

/** Linha "Faltam:" com cada agente não instalado e o seu Instalar (diálogos e Início). */
export function AgentesQueFaltam({ agentes }: { agentes: AgenteDetectado[] }) {
  const faltam = agentes.filter((a) => !a.instalado && a.agente !== 'terminal' && INSTALACAO[a.agente]);
  if (!faltam.length) return null;
  return (
    <div className="inst-faltam">
      <span className="inst-faltam-titulo">Agentes que faltam</span>
      <ul>
        {faltam.map((a) => (
          <li key={a.agente}>
            <span className="inst-nome">
              <LogoAgente agente={a.agente} tamanho={16} /> {NOME_AGENTE[a.agente]}
            </span>
            <InstalarAgente agente={a.agente} compacto />
          </li>
        ))}
      </ul>
    </div>
  );
}
