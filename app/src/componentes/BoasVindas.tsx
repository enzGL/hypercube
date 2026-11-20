// Boas-vindas do dia: aparece uma vez por dia quando o app abre.
// Conta os dias desde o primeiro uso ("DIA N NO HYPERCUBE").
import { useEffect, useState } from 'react';
import { nomeUsuario, type EstadoHiper } from '../estado/loja';
import { Hiper } from './Hiper';
import { Icone } from './Pecas';
import '../inicio.css';

const CHAVE_PRIMEIRO = 'hypercube.primeiroUso';
const CHAVE_VISTO = 'hypercube.boasVindasEm';

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento: o modal pode voltar a aparecer, sem problema */
  }
}

/** Dia N desde o primeiro uso (o primeiro dia é o dia 1). Grava a data na primeira vez. */
export function diaNoHypercube(): number {
  const hoje = hojeLocal();
  let primeiro = ler(CHAVE_PRIMEIRO);
  if (!primeiro || !/^\d{4}-\d{2}-\d{2}$/.test(primeiro)) {
    primeiro = hoje;
    gravar(CHAVE_PRIMEIRO, hoje);
  }
  const ms = Date.parse(`${hoje}T12:00:00`) - Date.parse(`${primeiro}T12:00:00`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export function deveMostrarBoasVindas(): boolean {
  if (new URLSearchParams(window.location.search).has('boasvindas')) return true;
  return ler(CHAVE_VISTO) !== hojeLocal();
}

export function marcarBoasVindasVista() {
  gravar(CHAVE_VISTO, hojeLocal());
}

interface Props {
  /** Nome na saudação; sem ele usa o que estiver salvo em `hypercube.nome`. */
  nome?: string;
  /** Chamado ao clicar em Começar (leve a pessoa para o Início). */
  aoComecar?: () => void;
  /** Chamado ao fechar de qualquer jeito (Pular, ×, Esc ou Começar). */
  aoFechar?: () => void;
  /** Força abrir mesmo que já tenha aparecido hoje. */
  forcar?: boolean;
}

export function BoasVindas({ nome, aoComecar, aoFechar, forcar = false }: Props) {
  const [aberto, setAberto] = useState(() => forcar || deveMostrarBoasVindas());
  const [dia] = useState(diaNoHypercube);
  const [hiper, setHiper] = useState<EstadoHiper>('repouso');
  const quem = (nome ?? nomeUsuario()).trim();

  const fechar = (comecar: boolean) => {
    marcarBoasVindasVista();
    setAberto(false);
    if (comecar) aoComecar?.();
    aoFechar?.();
  };

  useEffect(() => {
    if (!aberto) return;
    const t = window.setTimeout(() => setHiper('sucesso'), 650);
    const k = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') fechar(false);
    };
    window.addEventListener('keydown', k);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', k);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  if (!aberto) return null;

  const primeiroDia = dia === 1;
  return (
    <div className="bv-fundo" onMouseDown={() => fechar(false)}>
      <div className="bv" role="dialog" aria-modal="true" aria-labelledby="bv-titulo" onMouseDown={(ev) => ev.stopPropagation()}>
        <button className="icone-botao bv-fechar" onClick={() => fechar(false)} aria-label="Fechar">
          <Icone nome="fechar" tamanho={14} />
        </button>
        <div className="bv-hiper">
          <Hiper estado={hiper} tamanho={108} />
        </div>
        <p className="bv-dia mono">DIA {dia} NO HYPERCUBE</p>
        <h2 id="bv-titulo" className="bv-titulo">{quem ? `Olá, ${quem}` : 'Olá!'}</h2>
        <p className="bv-texto">
          {primeiroDia
            ? 'Que bom ter você aqui. Vamos montar o seu primeiro cubo de Vértices?'
            : 'Bem-vindo de volta. Vamos colocar os seus Vértices para trabalhar hoje?'}
        </p>
        <div className="bv-botoes">
          <button className="botao grande" onClick={() => fechar(false)}>
            Pular
          </button>
          <button className="botao grande primario" autoFocus onClick={() => fechar(true)}>
            Começar
          </button>
        </div>
      </div>
    </div>
  );
}
