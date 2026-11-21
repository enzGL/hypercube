// Terminal real na tela (xterm.js) ligado a um terminal do sistema por `nativo`.
// Ao desmontar só para de ouvir: o processo continua rodando.
import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { nativo } from '../nativo';
import { EVENTO_TEMA, token } from '../estado/tema';

// Cores do xterm a partir dos tokens do tema atual (refeitas quando o tema muda).
function temaXterm() {
  const fundo = token('--terminal', '#050916');
  const texto = token('--texto', '#E8E9EB');
  return {
    background: fundo,
    foreground: texto,
    cursor: token('--cobalto-claro', '#93A4FF'),
    cursorAccent: fundo,
    selectionBackground: token('--selecao', '#27356B'),
    black: token('--term-preto', '#0B132D'),
    blue: token('--trabalhando', '#93A4FF'),
    brightBlue: token('--term-azul-vivo', '#B7C3FF'),
    green: token('--pronto', '#4CC38A'),
    yellow: token('--esperando', '#E9A21B'),
    red: token('--erro', '#F0646E'),
    white: texto,
    brightBlack: token('--texto-2', '#9AA3C7'),
  };
}

export function Terminal({ terminalId, focado, aoFocar }: { terminalId: string; focado?: boolean; aoFocar?: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);

  useEffect(() => {
    const el = caixa.current!;
    const term = new XTerm({
      theme: temaXterm(),
      fontFamily: '"Geist Mono", ui-monospace, Consolas, monospace',
      fontSize: 14,
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

    // Liga o ouvinte antes de pedir o histórico; o que chegar no meio fica guardado e entra depois dele.
    let pendente: string[] | null = [];
    const desligar = nativo.terminais.aoReceber(terminalId, (d) => {
      if (pendente) pendente.push(d);
      else term.write(d);
    });
    nativo.terminais.historico(terminalId).then((h) => {
      if (!vivo) return;
      term.write(h);
      for (const d of pendente ?? []) term.write(d);
      pendente = null;
    });
    const entrada = term.onData((d) => nativo.terminais.escrever(terminalId, d));
    const trocarTema = () => {
      term.options.theme = temaXterm();
    };
    window.addEventListener(EVENTO_TEMA, trocarTema);

    return () => {
      vivo = false;
      obs.disconnect();
      desligar();
      entrada.dispose();
      window.removeEventListener(EVENTO_TEMA, trocarTema);
      term.dispose();
      termRef.current = null;
    };
  }, [terminalId]);

  useEffect(() => {
    if (focado) termRef.current?.focus();
  }, [focado]);

  return <div className="terminal" ref={caixa} onMouseDown={aoFocar} />;
}
