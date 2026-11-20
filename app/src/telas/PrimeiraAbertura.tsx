import { useEffect, useState } from 'react';
import { comecarComExemplo, comecarVazio } from '../estado/loja';
import { nativo, NOME_AGENTE, type AgenteDetectado } from '../nativo';
import { Hiper } from '../componentes/Hiper';
import { Icone } from '../componentes/Pecas';

export function PrimeiraAbertura() {
  const [agentes, setAgentes] = useState<AgenteDetectado[] | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => nativo.processos.detectarAgentes().then(setAgentes), 700);
    return () => clearTimeout(t);
  }, []);

  const abrirPasta = async () => {
    const pasta = await nativo.arquivos.escolherPasta();
    if (pasta) comecarVazio(pasta);
  };

  return (
    <div className="primeira-fundo">
      <div className="primeira-cartao" role="dialog" aria-labelledby="primeira-titulo">
        <div className="primeira-topo">
          <div className="primeira-hiper">
            <Hiper estado={agentes ? 'sucesso' : 'processando'} tamanho={76} />
          </div>
          <div>
            <span className="sobretitulo">Primeira abertura</span>
            <h1 id="primeira-titulo">Oi, eu sou o Hiper.</h1>
            <p className="secundario">
              Cada agente que você abre aqui vira um <b>Vértice</b>. Eu aviso quando alguém precisa de você.
            </p>
          </div>
        </div>

        <div className="detectados">
          <h3>{agentes ? 'Agentes neste computador' : 'Procurando agentes instalados…'}</h3>
          <ul>
            {(agentes ?? []).map((a) => (
              <li key={a.agente} className={a.instalado ? '' : 'ausente'}>
                <span style={{ color: a.instalado ? 'var(--pronto)' : 'var(--texto-2)' }}>{a.instalado ? '●' : '○'}</span>
                <span>{NOME_AGENTE[a.agente]}</span>
                <span className="mono secundario">{a.instalado ? `${a.comando} ${a.versao ?? ''}` : 'não encontrado'}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="primeira-acoes">
          <button className="botao primario" onClick={abrirPasta} disabled={!agentes}>
            <Icone nome="pasta" /> Abrir uma pasta de projeto
          </button>
          <button className="botao" onClick={() => comecarComExemplo()} disabled={!agentes}>
            Explorar com um exemplo
          </button>
        </div>
      </div>
    </div>
  );
}
