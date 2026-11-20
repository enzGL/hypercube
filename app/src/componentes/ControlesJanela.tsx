// Janela sem moldura do Windows: o app desenha os cantos, a borda e os botões minimizar, maximizar e fechar.
// No navegador (modo simulado) os botões não aparecem.
import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const noTauri = '__TAURI_INTERNALS__' in window;
if (noTauri) document.documentElement.dataset.tauri = '';

const janela = () => (noTauri ? getCurrentWindow() : null);

/** Marca o <html> com data-maximizada para a moldura perder os cantos quando a janela ocupa a tela. */
export function useJanelaMaximizada() {
  const [max, setMax] = useState(false);
  useEffect(() => {
    const w = janela();
    if (!w) return;
    const sync = () => {
      w.isMaximized().then((m) => {
        setMax(m);
        if (m) document.documentElement.dataset.maximizada = '';
        else delete document.documentElement.dataset.maximizada;
      });
    };
    sync();
    const off = w.onResized(sync);
    return () => {
      off.then((f) => f());
    };
  }, []);
  return max;
}

export function alternarMaximizar() {
  janela()?.toggleMaximize();
}

export function ControlesJanela() {
  const max = useJanelaMaximizada();
  if (!noTauri) return null;
  return (
    <div className="janela-controles">
      <button className="janela-botao" onClick={() => janela()?.minimize()} aria-label="Minimizar" title="Minimizar">
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 6h8" /></svg>
      </button>
      <button className="janela-botao" onClick={alternarMaximizar} aria-label={max ? 'Restaurar' : 'Maximizar'} title={max ? 'Restaurar' : 'Maximizar'}>
        {max ? (
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3.5 3.5V2h6.5v6.5H8.5M2 3.5h6.5V10H2Z" /></svg>
        ) : (
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1" /></svg>
        )}
      </button>
      <button className="janela-botao janela-fechar" onClick={() => janela()?.close()} aria-label="Fechar" title="Fechar">
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7" /></svg>
      </button>
    </div>
  );
}
