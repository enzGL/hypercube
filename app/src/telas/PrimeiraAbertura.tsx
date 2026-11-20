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
    <div className="primeira">
      <div className="primeira-marca">
        <img className="logo" src="./logo-hypercube.png" alt="" width={34} height={34} />
        <span className="marca">Hypercube</span>
      </div>
      <div className="primeira-corpo">
        <div className="primeira-hiper">
          <Hiper estado={agentes ? 'sucesso' : 'processando'} tamanho={220} />
        </div>
        <div className="primeira-texto">
          <span className="sobretitulo">Primeira abertura</span>
          <h1>Oi, eu sou o Hiper.</h1>
          <p className="lema">Todos os seus agentes, num cubo só.</p>
          <p className="secundario">
            Cada agente que você abre aqui vira um <b>Vértice</b>, com o seu terminal e o seu papel: líder, batedor, construtor ou revisor. Eu aviso quando alguém precisa de você.
          </p>

          <div className="cartao detectados">
            <h3>{agentes ? 'Agentes encontrados neste computador' : 'Procurando agentes instalados…'}</h3>
            <ul>
              {(agentes ?? []).map((a) => (
                <li key={a.agente} className={a.instalado ? '' : 'ausente'}>
                  <span style={{ color: a.instalado ? '#4CC38A' : '#9AA3C7' }}>{a.instalado ? '●' : '○'}</span>
                  <span>{NOME_AGENTE[a.agente]}</span>
                  <span className="mono secundario">{a.instalado ? `${a.comando} ${a.versao ?? ''}` : 'não encontrado'}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="primeira-acoes">
            <button className="botao primario grande" onClick={abrirPasta} disabled={!agentes}>
              <Icone nome="pasta" /> Abrir uma pasta de projeto
            </button>
            <button className="botao grande" onClick={() => comecarComExemplo()} disabled={!agentes}>
              Explorar com um exemplo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
