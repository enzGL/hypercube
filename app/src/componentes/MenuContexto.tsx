// Menu do clique direito, no visual do app. Um só na tela; quem quiser abrir chama `abrirMenu`.
// Fora de campos de texto, o menu do navegador nunca aparece: quem não tem menu próprio
// cai no menu da área vazia (ver `ligarMenuDoApp`).
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

export interface ItemMenu {
  rotulo: string;
  icone?: ReactNode;
  atalho?: string;
  acao?: () => void;
  /** Ação que apaga ou encerra: aparece em vermelho e pede um segundo clique. */
  perigo?: boolean;
  /** Texto do segundo clique (ex.: "Clique de novo para encerrar"). */
  confirmar?: string;
  desativado?: boolean;
}
export type EntradaMenu = ItemMenu | 'separador';

interface Aberto {
  x: number;
  y: number;
  titulo?: string;
  itens: EntradaMenu[];
}

let aberto: Aberto | null = null;
const ouvintes = new Set<() => void>();
function mudar(a: Aberto | null) {
  aberto = a;
  ouvintes.forEach((o) => o());
}

/** Abre o menu na posição do clique. Chame no onContextMenu (o preventDefault fica aqui). */
export function abrirMenu(ev: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation?: () => void }, itens: EntradaMenu[], titulo?: string) {
  ev.preventDefault();
  ev.stopPropagation?.();
  const limpos = itens.filter((i, k, t) => i !== 'separador' || (k > 0 && k < t.length - 1 && t[k - 1] !== 'separador'));
  mudar({ x: ev.clientX, y: ev.clientY, titulo, itens: limpos });
}

export function fecharMenu() {
  if (aberto) mudar(null);
}

const ehCampo = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest('input, textarea, [contenteditable="true"], select') && !el.closest('.xterm');

/**
 * Liga o menu do app no documento todo: campos de texto continuam com o menu do sistema
 * (copiar e colar); o resto, se ninguém abriu um menu próprio, ganha o menu da área vazia.
 */
export function ligarMenuDoApp(menuVazio: () => EntradaMenu[]): () => void {
  const f = (ev: MouseEvent) => {
    if (ev.defaultPrevented) return;
    if (ehCampo(ev.target)) return;
    abrirMenu(ev, menuVazio());
  };
  document.addEventListener('contextmenu', f);
  return () => document.removeEventListener('contextmenu', f);
}

export function MenuContexto() {
  const a = useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => aberto,
  );
  if (!a) return null;
  return <Menu key={`${a.x},${a.y},${a.itens.length}`} a={a} />;
}

function Menu({ a }: { a: Aberto }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: a.x, y: a.y });
  const [ativo, setAtivo] = useState(-1);
  const [confirmando, setConfirmando] = useState(-1);
  const clicaveis = a.itens.map((i, k) => (i !== 'separador' && !i.desativado ? k : -1)).filter((k) => k >= 0);

  // Não deixa o menu sair da tela: vira para a esquerda ou para cima quando precisa.
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const m = 6;
    const x = a.x + r.width > window.innerWidth - m ? Math.max(m, a.x - r.width) : a.x;
    const y = a.y + r.height > window.innerHeight - m ? Math.max(m, window.innerHeight - m - r.height) : a.y;
    setPos({ x, y });
    el.focus();
  }, [a]);

  useEffect(() => {
    const fora = (ev: MouseEvent) => {
      if (!caixa.current?.contains(ev.target as Node)) fecharMenu();
    };
    const fechar = () => fecharMenu();
    window.addEventListener('mousedown', fora, true);
    window.addEventListener('blur', fechar);
    window.addEventListener('resize', fechar);
    return () => {
      window.removeEventListener('mousedown', fora, true);
      window.removeEventListener('blur', fechar);
      window.removeEventListener('resize', fechar);
    };
  }, []);

  const executar = (k: number) => {
    const i = a.itens[k];
    if (!i || i === 'separador' || i.desativado) return;
    if (i.perigo && confirmando !== k) {
      setConfirmando(k);
      setAtivo(k);
      return;
    }
    fecharMenu();
    i.acao?.();
  };

  const mover = (passo: number) => {
    if (!clicaveis.length) return;
    const atual = clicaveis.indexOf(ativo);
    const prox = atual < 0 ? (passo > 0 ? 0 : clicaveis.length - 1) : (atual + passo + clicaveis.length) % clicaveis.length;
    setAtivo(clicaveis[prox]);
    setConfirmando(-1);
  };

  return (
    <div
      ref={caixa}
      className="menu-contexto"
      role="menu"
      aria-label={a.titulo ?? 'Opções'}
      tabIndex={-1}
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(ev) => ev.preventDefault()}
      onKeyDown={(ev) => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          fecharMenu();
        } else if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          mover(1);
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          mover(-1);
        } else if (ev.key === 'Home') {
          ev.preventDefault();
          setAtivo(clicaveis[0] ?? -1);
        } else if (ev.key === 'End') {
          ev.preventDefault();
          setAtivo(clicaveis[clicaveis.length - 1] ?? -1);
        } else if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          executar(ativo);
        }
      }}
    >
      {a.titulo && <div className="menu-titulo">{a.titulo}</div>}
      {a.itens.map((i, k) =>
        i === 'separador' ? (
          <div key={k} className="menu-separador" role="separator" />
        ) : (
          <button
            key={k}
            role="menuitem"
            className={`menu-item ${i.perigo ? 'perigo' : ''} ${ativo === k ? 'ativo' : ''} ${confirmando === k ? 'confirmando' : ''}`}
            disabled={i.desativado}
            tabIndex={-1}
            onMouseEnter={() => setAtivo(k)}
            onClick={() => executar(k)}
          >
            <span className="menu-icone" aria-hidden="true">
              {i.icone}
            </span>
            <span className="menu-rotulo">{confirmando === k ? i.confirmar ?? `Clique de novo: ${i.rotulo.toLowerCase()}` : i.rotulo}</span>
            {i.atalho && <kbd className="menu-atalho">{i.atalho}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
