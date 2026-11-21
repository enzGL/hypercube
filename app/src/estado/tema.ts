// Temas do app. O tema vale para a página toda via `data-tema` no <html>; cada tema
// define os tokens de cor em estilos.css, sob :root[data-tema="…"].
// O tema é aplicado já no import (antes do primeiro render) para não piscar.
import { useSyncExternalStore } from 'react';

export type IdTema = 'noite' | 'claro' | 'claro-console' | 'escuro' | 'papel';

export interface InfoTema {
  id: IdTema;
  nome: string;
  descricao: string;
  modo: 'claro' | 'escuro';
  /** Três cores de amostra para a prévia: lateral, fundo/cartão e destaque. */
  amostra: [string, string, string];
  /** Cor do texto na prévia. */
  textoAmostra: string;
  experimental?: boolean;
}

export const TEMAS: InfoTema[] = [
  {
    id: 'noite',
    nome: 'Noite',
    descricao: 'O azul-noite do Hypercube. É o padrão.',
    modo: 'escuro',
    amostra: ['#080E22', '#0E1738', '#93A4FF'],
    textoAmostra: '#E8E9EB',
  },
  {
    id: 'claro',
    nome: 'Claro',
    descricao: 'Fundo branco com o cobalto de sempre.',
    modo: 'claro',
    amostra: ['#F4F2EC', '#FFFFFF', '#2238C4'],
    textoAmostra: '#142057',
  },
  {
    id: 'claro-console',
    nome: 'Console claro',
    descricao: 'Branco com cara de terminal: letra mono, cantos retos, bordas finas.',
    modo: 'claro',
    amostra: ['#F3F3F1', '#FFFFFF', '#1A2DA6'],
    textoAmostra: '#1B1B1F',
  },
  {
    id: 'escuro',
    nome: 'Escuro',
    descricao: 'Preto neutro, sem o azul no fundo.',
    modo: 'escuro',
    amostra: ['#0A0A0B', '#18181B', '#93A4FF'],
    textoAmostra: '#EDEDEF',
  },
  {
    id: 'papel',
    nome: 'Papel',
    descricao: 'Creme quente, como papel de caderno.',
    modo: 'claro',
    amostra: ['#EFE9DA', '#FBF7EE', '#2238C4'],
    textoAmostra: '#2A2418',
    experimental: true,
  },
];

export const TEMA_PADRAO: IdTema = 'noite';
const CHAVE = 'hypercube.tema';
export const EVENTO_TEMA = 'hypercube:tema';

function valido(id: string | null | undefined): id is IdTema {
  return !!id && TEMAS.some((t) => t.id === id);
}

function lerSalvo(): IdTema {
  try {
    const v = localStorage.getItem(CHAVE);
    if (valido(v)) return v;
  } catch {
    /* sem armazenamento */
  }
  return TEMA_PADRAO;
}

function aplicar(id: IdTema) {
  const raiz = document.documentElement;
  raiz.dataset.tema = id;
  raiz.style.colorScheme = TEMAS.find((t) => t.id === id)?.modo === 'claro' ? 'light' : 'dark';
}

let atual: IdTema = lerSalvo();

// `?tema=<id>` na URL escolhe e salva o tema (útil para testar cada tema).
try {
  const daUrl = new URLSearchParams(window.location.search).get('tema');
  if (valido(daUrl)) {
    atual = daUrl;
    localStorage.setItem(CHAVE, daUrl);
  }
} catch {
  /* sem URL ou sem armazenamento */
}
aplicar(atual);

const ouvintes = new Set<() => void>();

export function temaAtual(): IdTema {
  return atual;
}

export function definirTema(id: IdTema) {
  if (!valido(id) || id === atual) return;
  atual = id;
  aplicar(id);
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
  ouvintes.forEach((f) => f());
  window.dispatchEvent(new CustomEvent(EVENTO_TEMA, { detail: id }));
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

export function useTema(): IdTema {
  return useSyncExternalStore(assinar, temaAtual, temaAtual);
}

/** Lê um token de cor do tema atual (para canvas, xterm e afins). */
export function token(nome: string, reserva = ''): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || reserva;
  } catch {
    return reserva;
  }
}
