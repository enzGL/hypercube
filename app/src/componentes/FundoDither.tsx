// Fundo do Início: o cubo do Hiper dentro do aro (hipercubo em projeção), desenhado
// em canvas e convertido em pontilhado de caracteres (dither ordenado 4×4).
// Gira devagar; com "reduzir movimento" fica parado num ângulo fixo.
import { useEffect, useRef } from 'react';
import { EVENTO_TEMA } from '../estado/tema';
import '../inicio.css';

type V3 = [number, number, number];

// Cubo interno (o corpo do Hiper) e cubo externo (o aro): 8 vértices cada.
const CUBO: V3[] = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const ARESTAS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];
const FACES: number[][] = [
  [0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1],
  [3, 2, 6, 7], [0, 3, 7, 4], [1, 5, 6, 2],
];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
const RAMPA = ' .·:-=+*#%@';
const CELULA_L = 8;
const CELULA_A = 12;

function girar([x, y, z]: V3, a: number, b: number): V3 {
  // em torno de Y (a) e depois de X (b)
  const x1 = x * Math.cos(a) + z * Math.sin(a);
  const z1 = -x * Math.sin(a) + z * Math.cos(a);
  const y2 = y * Math.cos(b) - z1 * Math.sin(b);
  const z2 = y * Math.sin(b) + z1 * Math.cos(b);
  return [x1, y2, z2];
}

function desenharCena(g: CanvasRenderingContext2D, l: number, h: number, t: number) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, l, h);
  const a = 0.62 + t * 0.00012;
  const b = -0.52 + Math.sin(t * 0.00007) * 0.12;
  const escala = Math.min(l, h) * 0.22;
  const cx = l * 0.5;
  const cy = h * 0.5;
  const projetar = (p: V3, s: number): [number, number, number] => {
    const [x, y, z] = girar([p[0] * s, p[1] * s, p[2] * s], a, b);
    const f = 4.2 / (4.2 + z * 0.35);
    return [cx + x * escala * f, cy + y * escala * f, z];
  };
  const fora = CUBO.map((p) => projetar(p, 1.9));
  const dentro = CUBO.map((p) => projetar(p, 1));

  g.lineCap = 'round';
  // aro: cubo externo e as 8 ligações até o cubo interno
  g.strokeStyle = 'rgb(120,120,120)';
  g.lineWidth = Math.max(1.2, escala * 0.045);
  g.beginPath();
  for (const [i, j] of ARESTAS) {
    g.moveTo(fora[i][0], fora[i][1]);
    g.lineTo(fora[j][0], fora[j][1]);
  }
  g.stroke();
  g.strokeStyle = 'rgb(80,80,80)';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    g.moveTo(fora[i][0], fora[i][1]);
    g.lineTo(dentro[i][0], dentro[i][1]);
  }
  g.stroke();

  // corpo: faces visíveis do cubo interno em três tons, de trás para frente
  const luz: V3 = [-0.35, -0.8, -0.5];
  const faces = FACES.map((f) => {
    const [p0, p1, p2] = f.map((i) => girar(CUBO[i], a, b));
    const u: V3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const v: V3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const tam = Math.hypot(...n) || 1;
    const z = f.reduce((s, i) => s + dentro[i][2], 0) / 4;
    const brilho = Math.max(0, -(n[0] * luz[0] + n[1] * luz[1] + n[2] * luz[2]) / tam);
    return { f, z, visivel: n[2] / tam < 0, brilho };
  });
  faces
    .filter((x) => x.visivel)
    .sort((x, y) => y.z - x.z)
    .forEach(({ f, brilho }) => {
      const c = Math.round(120 + brilho * 135);
      g.fillStyle = `rgb(${c},${c},${c})`;
      g.beginPath();
      f.forEach((i, k) => (k ? g.lineTo(dentro[i][0], dentro[i][1]) : g.moveTo(dentro[i][0], dentro[i][1])));
      g.closePath();
      g.fill();
    });
  g.strokeStyle = 'rgb(255,255,255)';
  g.lineWidth = Math.max(1, escala * 0.03);
  g.beginPath();
  for (const [i, j] of ARESTAS) {
    g.moveTo(dentro[i][0], dentro[i][1]);
    g.lineTo(dentro[j][0], dentro[j][1]);
  }
  g.stroke();
}

export function FundoDither({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tela = ref.current;
    if (!tela) return;
    const ctx = tela.getContext('2d');
    const cena = document.createElement('canvas');
    const g = cena.getContext('2d', { willReadFrequently: true });
    if (!ctx || !g) return;

    const parado = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const lerCor = () => getComputedStyle(tela).getPropertyValue('--cobalto-claro').trim() || 'currentColor';
    let cor = lerCor();
    let cols = 0;
    let linhas = 0;
    let quadro = 0;
    let ultimo = 0;
    const inicio = performance.now() - 40_000;

    const medir = () => {
      const r = tela.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      tela.width = Math.max(1, Math.round(r.width * dpr));
      tela.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(1, Math.floor(r.width / CELULA_L));
      linhas = Math.max(1, Math.floor(r.height / CELULA_A));
      // a cena é desenhada com 1 px por célula; a proporção da célula corrige o achatamento
      cena.width = cols;
      cena.height = linhas;
      g.setTransform(1, 0, 0, CELULA_L / CELULA_A, 0, 0);
    };

    const pintar = (agora: number) => {
      const t = agora - inicio;
      desenharCena(g, cols, linhas / (CELULA_L / CELULA_A), t);
      const px = g.getImageData(0, 0, cols, linhas).data;
      ctx.clearRect(0, 0, tela.width, tela.height);
      ctx.font = `${CELULA_A - 1}px ${getComputedStyle(tela).getPropertyValue('--f-mono') || 'monospace'}`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = cor;
      const n = RAMPA.length - 1;
      for (let y = 0; y < linhas; y++) {
        for (let x = 0; x < cols; x++) {
          const lum = px[(y * cols + x) * 4] / 255;
          if (lum < 0.04) continue;
          const limiar = BAYER[(y & 3) * 4 + (x & 3)];
          const nivel = Math.min(n, Math.floor(lum * n + limiar));
          if (nivel <= 0) continue;
          ctx.globalAlpha = 0.25 + 0.75 * lum;
          ctx.fillText(RAMPA[nivel], x * CELULA_L, y * CELULA_A);
        }
      }
      ctx.globalAlpha = 1;
    };

    const laco = (agora: number) => {
      quadro = requestAnimationFrame(laco);
      if (document.hidden || agora - ultimo < 80) return; // ~12 quadros por segundo bastam
      ultimo = agora;
      pintar(agora);
    };

    medir();
    pintar(performance.now());
    if (!parado) quadro = requestAnimationFrame(laco);
    const obs = new ResizeObserver(() => {
      medir();
      pintar(performance.now());
    });
    obs.observe(tela);
    // troca de tema: relê a cor e repinta
    const trocarTema = () => {
      cor = lerCor();
      pintar(performance.now());
    };
    window.addEventListener(EVENTO_TEMA, trocarTema);
    return () => {
      cancelAnimationFrame(quadro);
      obs.disconnect();
      window.removeEventListener(EVENTO_TEMA, trocarTema);
    };
  }, []);

  return <canvas ref={ref} className={`fundo-dither ${className}`} aria-hidden="true" />;
}
