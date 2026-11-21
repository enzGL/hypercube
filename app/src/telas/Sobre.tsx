import { useState } from 'react';
import { refazerPrimeiraAbertura, useLoja } from '../estado/loja';
import { nativo } from '../nativo';
import { Hiper } from '../componentes/Hiper';
import { EscolherTema } from '../componentes/EscolherTema';


export function Sobre() {
  return (
    <div className="tela-sobre rolagem">
      <div className="sobre-cartao">
        <img className="logo grande" src="./logo-hypercube.png" alt="Logo do Hypercube" width={120} height={120} />
        <h1>Hypercube</h1>
        <p className="lema">Todos os seus agentes, num cubo só.</p>
        <p className="secundario">Versão 0.1 · {nativo.modo === 'simulado' ? 'modo simulado (sem terminais de verdade)' : 'app desktop'}</p>
        <div className="sobre-hiper">
          <Hiper estado="sucesso" tamanho={80} />
          <p>
            Um tesseract é um hipercubo. O <b>Hiper</b> acompanha todos os seus agentes.
          </p>
        </div>
        <ul className="sobre-lista secundario">
          <li>Código aberto, licença MIT. O nome, o Hiper e a logo não entram na licença.</li>
          <li>Tudo fica no seu computador: nada vai para a nuvem.</li>
          <li>
            Atalho <kbd>Alt</kbd>+<kbd>N</kbd>: vai para o agente que espera há mais tempo.
          </li>
        </ul>
        <section className="sobre-aparencia" aria-labelledby="sobre-aparencia-titulo">
          <h2 id="sobre-aparencia-titulo">Aparência</h2>
          <p className="secundario">Escolha o tema. Vale na hora e fica salvo neste computador.</p>
          <EscolherTema />
        </section>
        <RefazerIntroducao />
      </div>
    </div>
  );
}

function RefazerIntroducao() {
  const e = useLoja();
  const [confirmar, setConfirmar] = useState(false);
  const n = e.vertices.length;
  if (!confirmar) {
    return (
      <button className="botao" onClick={() => (n ? setConfirmar(true) : refazerPrimeiraAbertura())}>
        Ver a introdução de novo
      </button>
    );
  }
  return (
    <div className="faixa faixa-erro sobre-confirmar">
      <span>
        Isso fecha {n} {n === 1 ? 'terminal' : 'terminais'}. Continuar?
      </span>
      <button className="botao perigo" onClick={refazerPrimeiraAbertura}>
        Fechar e ver
      </button>
      <button className="botao" onClick={() => setConfirmar(false)}>
        Cancelar
      </button>
    </div>
  );
}
