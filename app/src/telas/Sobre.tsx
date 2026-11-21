import { refazerPrimeiraAbertura } from '../estado/loja';
import { nativo } from '../nativo';
import { Hiper } from '../componentes/Hiper';


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
        <button className="botao" onClick={refazerPrimeiraAbertura}>
          Ver a primeira abertura de novo
        </button>
      </div>
    </div>
  );
}
