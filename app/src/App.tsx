import { useEffect } from 'react';
import { fecharAviso, focar, irParaQuemEspera, useLoja, ESTADO_INFO } from './estado/loja';
import { BarraLateral } from './componentes/BarraLateral';
import { Dialogos } from './componentes/Dialogos';
import { Imagens } from './telas/Imagens';
import { Orquestracao } from './telas/Orquestracao';
import { PrimeiraAbertura } from './telas/PrimeiraAbertura';
import { Roteador } from './telas/Roteador';
import { Sessoes } from './telas/Sessoes';
import { Sobre } from './telas/Sobre';
import { Icone } from './componentes/Pecas';

export function App() {
  const e = useLoja();

  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (ev.altKey && (ev.key === 'n' || ev.key === 'N')) {
        ev.preventDefault();
        irParaQuemEspera();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  if (!e.configurado) return <PrimeiraAbertura />;

  return (
    <div className="app">
      <BarraLateral />
      <main className="principal">
        {e.tela === 'sessoes' && <Sessoes />}
        {e.tela === 'orquestracao' && <Orquestracao />}
        {e.tela === 'imagens' && <Imagens />}
        {e.tela === 'roteador' && <Roteador />}
        {e.tela === 'sobre' && <Sobre />}
      </main>
      <Dialogos />
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
