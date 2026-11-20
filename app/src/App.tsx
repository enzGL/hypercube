/// <reference types="vite/client" />
import { useEffect, type ComponentType } from 'react';
import { fecharAviso, focar, irPara, irParaQuemEspera, nomeUsuario, useLoja, ESTADO_INFO } from './estado/loja';
import { pedirNovaTarefa, useCasca, type Rota } from './estado/casca';
import { BarraLateral } from './componentes/BarraLateral';
import { BarraTopo } from './componentes/BarraTopo';
import { PainelDireito } from './componentes/PainelDireito';
import { Dialogos } from './componentes/Dialogos';
import { BoasVindas } from './componentes/BoasVindas';
import { PainelOrquestracao } from './componentes/PainelOrquestracao';
import { Imagens } from './telas/Imagens';
import { Orquestracao } from './telas/Orquestracao';
import { PrimeiraAbertura } from './telas/PrimeiraAbertura';
import { Roteador } from './telas/Roteador';
import { Sessoes } from './telas/Sessoes';
import { Sobre } from './telas/Sobre';
import { Icone } from './componentes/Pecas';

// A tela Início vem de telas/Inicio.tsx quando ela existir; até lá fica o marcador abaixo.
const modulosInicio = import.meta.glob<{ Inicio?: ComponentType; default?: ComponentType }>('./telas/Inicio.tsx', { eager: true });
const InicioDoArquivo = Object.values(modulosInicio)[0]?.Inicio ?? Object.values(modulosInicio)[0]?.default;

function InicioProvisorio() {
  return (
    <div className="inicio-provisorio">
      <h2>Início</h2>
      <p>A tela de início entra aqui.</p>
    </div>
  );
}

const Inicio: ComponentType = InicioDoArquivo ?? InicioProvisorio;

export function App() {
  const e = useLoja();
  const casca = useCasca();
  const rota = e.tela as Rota;

  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (ev.altKey && (ev.key === 'n' || ev.key === 'N')) {
        ev.preventDefault();
        irParaQuemEspera();
      } else if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && (ev.key === 'n' || ev.key === 'N')) {
        ev.preventDefault();
        pedirNovaTarefa();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  if (!e.configurado) return <PrimeiraAbertura />;

  return (
    <div className={`app ${casca.lateralRecolhida ? 'com-lateral-recolhida' : ''} ${casca.painelAberto ? 'com-painel' : ''}`}>
      <BarraTopo />
      <BarraLateral />
      <main className="principal">
        {rota === 'inicio' && <Inicio />}
        {rota === 'sessoes' && (
          <div className="centro-sessoes">
            <div className="area-sessoes">
              <Sessoes />
            </div>
            <PainelOrquestracao />
          </div>
        )}
        {rota === 'orquestracao' && <Orquestracao />}
        {rota === 'imagens' && <Imagens />}
        {rota === 'roteador' && <Roteador />}
        {rota === 'sobre' && <Sobre />}
      </main>
      {casca.painelAberto && <PainelDireito />}
      <Dialogos />
      <BoasVindas nome={nomeUsuario() || undefined} aoComecar={() => irPara('inicio')} />
      <div className="avisos" aria-live="polite">
        {e.avisos.map((a) => (
          <div key={a.id} className={`aviso aviso-${a.tipo}`}>
            {a.tipo !== 'info' && (
              <span className="estado-simbolo" style={{ color: ESTADO_INFO[a.tipo].cor }}>
                {ESTADO_INFO[a.tipo].simbolo}
              </span>
            )}
            <span className="aviso-texto">{a.texto}</span>
            {a.verticeId && (
              <button
                className="link"
                onClick={() => {
                  focar(a.verticeId!);
                  fecharAviso(a.id);
                }}
              >
                Ver
              </button>
            )}
            <button className="icone-botao" onClick={() => fecharAviso(a.id)} aria-label="Fechar aviso">
              <Icone nome="fechar" tamanho={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
