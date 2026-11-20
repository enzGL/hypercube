// Hiper pequeno (14–20 px) para a lateral e as abas: a projeção do cubo em pixel art.
// Mesma silhueta do Hiper (hexágono com o "Y" do cubo), numa grade de 9 × 10 quadradinhos.
// Trabalhando, os vértices acendem um a um em volta do cubo, com rastro, e o centro
// (onde os dois vértices escondidos se encontram) pisca junto. A cor diz o estado.
import type { EstadoVertice } from '../estado/loja';
import '../orquestracao.css';

export type EstadoHiperMini = EstadoVertice | 'repouso';

interface Props {
  estado?: EstadoHiperMini;
  /** Largura em px (a altura acompanha a grade). Pensado para 14 a 20. */
  tamanho?: number;
  rotulo?: string;
}

const COLUNAS = 9;
const LINHAS = 10;

// Cantos do hexágono, em volta, começando no de cima (mesma ordem do Hiper).
const CANTOS: [number, number][] = [
  [4, 0],
  [8, 2],
  [8, 7],
  [4, 9],
  [0, 7],
  [0, 2],
];
const CENTRO: [number, number] = [4, 4];

// Arestas desenhadas à mão, em degraus de 2 por 1 (isométrico em pixel art):
// o contorno do hexágono e o "Y" do cubo, que sai do centro para 3 cantos alternados.
const ARESTAS: [number, number][] = [
  // contorno, em cima
  [2, 1], [3, 1], [5, 1], [6, 1], [1, 2], [7, 2],
  // laterais
  [0, 3], [0, 4], [0, 5], [0, 6], [8, 3], [8, 4], [8, 5], [8, 6],
  // contorno, embaixo
  [1, 7], [7, 7], [2, 8], [3, 8], [5, 8], [6, 8],
  // o "Y" do cubo
  [2, 3], [3, 3], [5, 3], [6, 3], [4, 5], [4, 6], [4, 7], [4, 8],
];

const NOME_ESTADO: Record<EstadoHiperMini, string> = {
  trabalhando: 'trabalhando',
  esperando: 'esperando você',
  pronto: 'pronto',
  erro: 'com erro',
  repouso: 'parado',
};

export function HiperMini({ estado = 'repouso', tamanho = 16, rotulo }: Props) {
  return (
    <span
      className="hiper-mini"
      data-e={estado}
      role="img"
      aria-label={rotulo ?? `Hiper ${NOME_ESTADO[estado]}`}
      style={{ width: tamanho, height: Math.round((tamanho * LINHAS) / COLUNAS) }}
    >
      <svg viewBox={`0 0 ${COLUNAS} ${LINHAS}`} shapeRendering="crispEdges" aria-hidden="true">
        <g className="hm-arestas">
          {ARESTAS.map(([x, y]) => (
            <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} />
          ))}
        </g>
        <g className="hm-cantos">
          {CANTOS.map(([x, y], i) => (
            <rect key={i} className="hm-canto" x={x} y={y} width={1} height={1} style={{ ['--i' as string]: i }} />
          ))}
        </g>
        <rect className="hm-centro" x={CENTRO[0]} y={CENTRO[1]} width={1} height={1} />
      </svg>
    </span>
  );
}
