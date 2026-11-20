// Terminal real na tela (xterm.js) ligado a um terminal do sistema por `nativo`.
// Ao desmontar só para de ouvir: o processo continua rodando.
import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { nativo } from '../nativo';

const TEMA = {
  background: '#050916',
  foreground: '#E8E9EB',
  cursor: '#93A4FF',
  cursorAccent: '#050916',
  selectionBackground: '#27356B',
  black: '#0B132D',
  blue: '#93A4FF',
  brightBlue: '#B7C3FF',
  green: '#4CC38A',
  yellow: '#E9A21B',
  red: '#F0646E',
  white: '#E8E9EB',
  brightBlack: '#9AA3C7',
};

export function Terminal({ terminalId, focado, aoFocar }: { terminalId: string; focado?: boolean; aoFocar?: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);

  useEffect(() => {
    const el = caixa.current!;
    const term = new XTerm({
      theme: TEMA,
      fontFamily: '"Geist Mono", ui-monospace, Consolas, monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    termRef.current = term;
    let vivo = true;

    const ajustar = () => {
      if (!el.offsetWidth || !el.offsetHeight) return;
      try {
        fit.fit();
        nativo.terminais.redimensionar(terminalId, term.cols, term.rows);
      } catch {
        /* ainda sem tamanho */
      }
    };
    const obs = new ResizeObserver(ajustar);
    obs.observe(el);
    requestAnimationFrame(ajustar);

    let desligar = () => {};
    nativo.terminais.historico(terminalId).then((h) => {
      if (!vivo) return;
      term.write(h);
      desligar = nativo.terminais.aoReceber(terminalId, (d) => term.write(d));
    });
    const entrada = term.onData((d) => nativo.terminais.escrever(terminalId, d));

    return () => {
      vivo = false;
      obs.disconnect();
      desligar();
      entrada.dispose();
      term.dispose();
      termRef.current = null;
    };
  }, [terminalId]);

  useEffect(() => {
    if (focado) termRef.current?.focus();
  }, [focado]);

  return <div className="terminal" ref={caixa} onMouseDown={aoFocar} />;
}
