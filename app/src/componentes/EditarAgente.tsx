// Cartão pequeno para dar apelido e cor a um agente. Fica por cima do app, ancorado
// em quem abriu, sem travar o resto da tela. Tem a própria raiz React: quem quiser
// abrir só chama `abrirEditarAgente(id, ancora)`.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import {
  agentePersonalizado,
  COR_PAPEL,
  corDoAgente,
  definirCorAgente,
  definirPadraoPapel,
  NOME_PAPEL,
  nomeDoAgente,
  nomePadraoDoAgente,
  padraoDoPapel,
  PALETA_AGENTES,
  renomearAgente,
  restaurarAgente,
  restaurarPadraoPapel,
  useLoja,
  type EstadoVertice,
  type Papel,
  type Vertice,
} from '../estado/loja';
import { SimboloEstado } from './Pecas';
import '../agentes.css';

/** Plural do papel para "Usar como padrão para …". */
const PLURAL_PAPEL: Record<Papel, string> = {
  agente: 'agentes comuns',
  lider: 'líderes',
  batedor: 'exploradores',
  construtor: 'construtores',
  revisor: 'revisores',
  consertador: 'mecânicos',
  subagente: 'subagentes',
};

/** O mascote do agente: o cubo na cor escolhida e o acessório do papel. */
export function MascoteAgente({
  cor,
  tamanho = 20,
  estado,
  papel,
  entrada,
}: {
  cor: string;
  tamanho?: number;
  estado?: EstadoVertice;
  papel?: Papel;
  /** Anima a entrada (as faces se juntam). Só na primeira vez que o agente aparece. */
  entrada?: boolean;
}) {
  const acessorio = papel ? ACESSORIO[papel] : null;
  // Com acessório a caixa cresce para caber o chapéu, o headset ou a chave.
  const caixa = acessorio ? '28 38 160 160' : '40 64 120 128';
  return (
    <span
      className={`mini-vertice ${estado === 'trabalhando' ? 'mini-ativo' : ''} ${entrada ? 'mascote-entrada' : ''}`}
      style={{ width: tamanho, height: tamanho }}
      aria-hidden="true"
    >
      <svg viewBox={caixa} width={tamanho} height={tamanho} overflow="visible">
        <g className="m-face m-topo">
          <path d="M100 72 L150 100 L100 128 L50 100 Z" fill={cor} stroke={cor} strokeWidth="12" strokeLinejoin="round" />
          <path d="M100 72 L150 100 L100 128 L50 100 Z" fill="#FFFFFF" opacity=".28" />
        </g>
        <g className="m-face m-esq">
          <path d="M50 100 L100 128 L100 184 L50 156 Z" fill={cor} stroke={cor} strokeWidth="12" strokeLinejoin="round" />
        </g>
        <g className="m-face m-dir">
          <path d="M150 100 L100 128 L100 184 L150 156 Z" fill={cor} stroke={cor} strokeWidth="12" strokeLinejoin="round" />
          <path d="M150 100 L100 128 L100 184 L150 156 Z" fill="#000000" opacity=".25" />
        </g>
        <g className="m-olhos">
          <ellipse cx="78" cy="144" rx="8" ry="11" fill="#FFFFFF" />
          <ellipse cx="122" cy="144" rx="8" ry="11" fill="#FFFFFF" />
        </g>
        {acessorio && <g className="m-acessorio">{acessorio}</g>}
      </svg>
    </span>
  );
}

const CLARO = '#DDE3F5';

/** Um acessório por papel: diz o ofício de longe e continua legível em 14 a 20 px. */
const ACESSORIO: Partial<Record<Papel, JSX.Element>> = {
  lider: (
    <>
      <path d="M48 130 Q46 56 100 54 Q154 56 152 130" fill="none" stroke={CLARO} strokeWidth="8" strokeLinecap="round" />
      <rect x="36" y="116" width="20" height="34" rx="8" fill={CLARO} />
      <rect x="144" y="116" width="20" height="34" rx="8" fill={CLARO} />
      <path d="M46 150 Q50 178 82 174" fill="none" stroke={CLARO} strokeWidth="5" strokeLinecap="round" />
      <circle cx="86" cy="173" r="7" fill={CLARO} />
    </>
  ),
  batedor: (
    <>
      <ellipse cx="100" cy="94" rx="64" ry="14" fill="#B8935A" stroke="#7A5A2E" strokeWidth="3" />
      <path d="M68 92 Q70 50 100 48 Q130 50 132 92 Z" fill="#D2B077" stroke="#7A5A2E" strokeWidth="3" strokeLinejoin="round" />
      <path d="M69 80 L131 80 L132 91 L68 91 Z" fill="#6E4F26" />
    </>
  ),
  construtor: (
    <>
      <ellipse cx="100" cy="96" rx="52" ry="12" fill="#F2C230" stroke="#B98A0E" strokeWidth="3" />
      <path d="M62 95 Q62 48 100 44 Q138 48 138 95 Z" fill="#F2C230" stroke="#B98A0E" strokeWidth="3" strokeLinejoin="round" />
      <path d="M100 46 L100 93" fill="none" stroke="#B98A0E" strokeWidth="7" strokeLinecap="round" />
    </>
  ),
  revisor: (
    <>
      <circle cx="78" cy="144" r="17" fill="none" stroke="#14182E" strokeWidth="5" />
      <circle cx="122" cy="144" r="17" fill="none" stroke="#14182E" strokeWidth="5" />
      <path d="M95 142 Q100 136 105 142" fill="none" stroke="#14182E" strokeWidth="4" strokeLinecap="round" />
      <path d="M61 140 L52 134 M139 140 L148 134" fill="none" stroke="#14182E" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  consertador: (
    <g transform="rotate(32 166 140)">
      <path d="M154 92 L154 114 Q166 128 178 114 L178 92 L170 92 L170 108 L162 108 L162 92 Z" fill={CLARO} stroke="#9AA3C7" strokeWidth="2" strokeLinejoin="round" />
      <rect x="160" y="120" width="12" height="56" rx="6" fill={CLARO} stroke="#9AA3C7" strokeWidth="2" />
    </g>
  ),
};

/** Agentes que já fizeram a entrada: a animação roda só na primeira vez que cada um aparece. */
const jaEntraram = new Set<string>();
export function primeiraEntrada(id: string): boolean {
  if (jaEntraram.has(id)) return false;
  jaEntraram.add(id);
  return true;
}

// ---------- estado do cartão ----------

type Ancora = { x: number; y: number };
type Aberto = { id: string; ancora: Ancora } | null;

let aberto: Aberto = null;
const ouvintes = new Set<() => void>();
let raizMontada = false;

function mudarAberto(a: Aberto) {
  aberto = a;
  ouvintes.forEach((o) => o());
}

/** Abre o cartão de um agente. A âncora é um elemento (fica embaixo dele) ou um ponto (clique direito). */
export function abrirEditarAgente(id: string, ancora?: Element | Ancora | null) {
  let p: Ancora = { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 180 };
  if (ancora instanceof Element) {
    const r = ancora.getBoundingClientRect();
    p = { x: r.left, y: r.bottom + 6 };
  } else if (ancora) p = ancora;
  if (!raizMontada) {
    raizMontada = true;
    const div = document.createElement('div');
    div.className = 'editar-agente-raiz';
    document.body.appendChild(div);
    createRoot(div).render(<Hospedeiro />);
  }
  mudarAberto({ id, ancora: p });
}

export function fecharEditarAgente() {
  mudarAberto(null);
}

function Hospedeiro() {
  const a = useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => aberto,
  );
  const e = useLoja();
  const v = a ? e.vertices.find((x) => x.id === a.id) : undefined;
  if (!a || !v) return null;
  return <CartaoEditar key={a.id} v={v} ancora={a.ancora} />;
}

// ---------- cartão ----------

function CartaoEditar({ v, ancora }: { v: Vertice; ancora: Ancora }) {
  const ref = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const nomeAtual = nomeDoAgente(v);
  const [apelido, setApelido] = useState(nomeAtual);
  const [cor, setCor] = useState(corDoAgente(v));
  const [pos, setPos] = useState(ancora);
  const padrao = padraoDoPapel(v.papel);
  const papel = NOME_PAPEL[v.papel];
  const papelMudado = padrao.apelido !== papel || padrao.cor.toLowerCase() !== COR_PAPEL[v.papel].toLowerCase();

  // Mantém o cartão dentro da janela.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(12, Math.min(ancora.x, window.innerWidth - r.width - 12));
    const y = ancora.y + r.height > window.innerHeight - 12 ? Math.max(12, ancora.y - r.height - 12) : ancora.y;
    setPos({ x, y });
  }, [ancora]);

  useEffect(() => {
    campo.current?.focus();
    campo.current?.select();
    const fora = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) fecharEditarAgente();
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') fecharEditarAgente();
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, []);

  const salvar = () => {
    const a = apelido.trim();
    // Igual ao padrão = sem apelido próprio (segue o papel).
    const semApelido = !a || a === nomePadraoDoAgente(v);
    renomearAgente(v.id, semApelido ? '' : a);
    definirCorAgente(v.id, cor.toLowerCase() === padrao.cor.toLowerCase() ? '' : cor);
    fecharEditarAgente();
  };

  const usarComoPadrao = () => {
    const a = apelido.trim();
    // "Olheiro 2" vira padrão "Olheiro"; o número de cada agente continua.
    const base = a.replace(/\s+\d+$/, '');
    definirPadraoPapel(v.papel, { apelido: base || undefined, cor });
    restaurarAgente(v.id);
    fecharEditarAgente();
  };

  const naPaleta = PALETA_AGENTES.some((p) => p.cor.toLowerCase() === cor.toLowerCase());

  return (
    <div
      ref={ref}
      className="editar-agente"
      role="dialog"
      aria-label={`Editar ${nomeAtual}`}
      style={{ left: pos.x, top: pos.y, ['--cor-agente' as string]: cor }}
    >
      <div className="ea-previa" aria-hidden="true">
        <div className="ea-previa-cabeca">
          <MascoteAgente cor={cor} papel={v.papel} tamanho={22} estado={v.estado} />
          <span className="ea-previa-nome">{apelido.trim() || nomePadraoDoAgente(v)}</span>
          <SimboloEstado estado={v.estado} />
        </div>
        <div className="ea-previa-linha">
          <MascoteAgente cor={cor} tamanho={14} />
          <span>{apelido.trim() || nomePadraoDoAgente(v)}</span>
        </div>
      </div>

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          salvar();
        }}
      >
        <label className="ea-campo">
          <span>Apelido</span>
          <input ref={campo} value={apelido} maxLength={40} onChange={(ev) => setApelido(ev.target.value)} placeholder={nomePadraoDoAgente(v)} />
        </label>

        <fieldset className="ea-cores">
          <legend>Cor</legend>
          <div className="ea-paleta" role="radiogroup" aria-label="Cor do agente">
            {PALETA_AGENTES.map((p) => (
              <button
                key={p.cor}
                type="button"
                role="radio"
                aria-checked={p.cor.toLowerCase() === cor.toLowerCase()}
                aria-label={p.nome}
                title={p.nome}
                className="ea-cor"
                style={{ background: p.cor }}
                onClick={() => setCor(p.cor)}
              />
            ))}
            <label className={`ea-cor ea-livre ${naPaleta ? '' : 'escolhida'}`} title="Outra cor">
              <input type="color" value={cor} onChange={(ev) => setCor(ev.target.value)} aria-label="Outra cor" />
            </label>
          </div>
        </fieldset>

        <button type="button" className="ea-link" onClick={usarComoPadrao}>
          Usar como padrão para {PLURAL_PAPEL[v.papel]}
        </button>

        <div className="ea-acoes">
          <button
            type="button"
            className="botao pequeno"
            disabled={!agentePersonalizado(v) && !papelMudado}
            title={papelMudado ? `Tira o apelido e a cor deste agente e volta o papel ${papel} ao de fábrica` : 'Volta ao apelido e à cor do papel'}
            onClick={() => {
              restaurarAgente(v.id);
              if (papelMudado && !agentePersonalizado(v)) restaurarPadraoPapel(v.papel);
              fecharEditarAgente();
            }}
          >
            Restaurar
          </button>
          <span className="ea-espaco" />
          <button type="button" className="botao pequeno" onClick={fecharEditarAgente}>
            Cancelar
          </button>
          <button type="submit" className="botao primario pequeno">
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- renomear no lugar ----------

/** Nome editável no lugar: Enter salva, Esc cancela. */
export function NomeEditavel({ v, editando, aoTerminar }: { v: Vertice; editando: boolean; aoTerminar: () => void }) {
  const [texto, setTexto] = useState(nomeDoAgente(v));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editando) {
      setTexto(nomeDoAgente(v));
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.select();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);
  if (!editando) return null;
  const salvar = () => {
    const t = texto.trim();
    renomearAgente(v.id, !t || t === nomePadraoDoAgente(v) ? '' : t);
    aoTerminar();
  };
  return (
    <input
      ref={ref}
      className="nome-inline"
      value={texto}
      maxLength={40}
      aria-label="Apelido do agente"
      onChange={(ev) => setTexto(ev.target.value)}
      onKeyDown={(ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') salvar();
        if (ev.key === 'Escape') aoTerminar();
      }}
      onBlur={salvar}
      onClick={(ev) => ev.stopPropagation()}
      onDoubleClick={(ev) => ev.stopPropagation()}
    />
  );
}

export function IconeLapis({ tamanho = 13 }: { tamanho?: number }) {
  return (
    <svg className="icone" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}
