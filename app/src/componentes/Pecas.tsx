// Peças pequenas reaproveitadas: símbolo de estado, mini-mascote dos agentes, ícones.
import type { ReactNode } from 'react';
import { COR_PAPEL, ESTADO_INFO, type EstadoVertice, type Papel } from '../estado/loja';

export function SimboloEstado({ estado, comNome = false }: { estado: EstadoVertice; comNome?: boolean }) {
  const i = ESTADO_INFO[estado];
  return (
    <span className={`estado estado-${estado}`} style={{ color: i.cor }} title={i.nome} aria-label={i.nome}>
      <span className="estado-simbolo" aria-hidden="true">
        {i.simbolo}
      </span>
      {comNome && <span className="estado-nome">{i.nome}</span>}
    </span>
  );
}

/** Mini-mascote de cada agente: o cubo numa cor só, com olhos ovais brancos. */
export function MiniVertice({ papel, tamanho = 20, estado }: { papel: Papel; tamanho?: number; estado?: EstadoVertice }) {
  const c = COR_PAPEL[papel];
  return (
    <span className={`mini-vertice ${estado === 'trabalhando' ? 'mini-ativo' : ''}`} style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      <svg viewBox="40 34 120 128" width={tamanho} height={tamanho}>
        <path d="M100 42 L150 70 L100 98 L50 70 Z" fill={c} stroke={c} strokeWidth="12" strokeLinejoin="round" />
        <path d="M100 42 L150 70 L100 98 L50 70 Z" fill="#FFFFFF" opacity=".28" />
        <path d="M50 70 L100 98 L100 154 L50 126 Z" fill={c} stroke={c} strokeWidth="12" strokeLinejoin="round" />
        <path d="M150 70 L100 98 L100 154 L150 126 Z" fill={c} stroke={c} strokeWidth="12" strokeLinejoin="round" />
        <path d="M150 70 L100 98 L100 154 L150 126 Z" fill="#000000" opacity=".25" />
        <ellipse cx="78" cy="114" rx="8" ry="11" fill="#FFFFFF" />
        <ellipse cx="122" cy="114" rx="8" ry="11" fill="#FFFFFF" />
      </svg>
    </span>
  );
}

const caminhos: Record<string, ReactNode> = {
  sessoes: (
    <>
      <rect x="3" y="4" width="8" height="7" rx="1.5" />
      <rect x="13" y="4" width="8" height="7" rx="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" />
      <rect x="13" y="13" width="8" height="7" rx="1.5" />
    </>
  ),
  orquestracao: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8 7.5 10.8 16M16 7.5 13.2 16M8.5 6h7" />
    </>
  ),
  imagens: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m3 18 6-5 4 3 3-2 5 4" />
    </>
  ),
  roteador: (
    <>
      <path d="M4 7h11l-3-3M20 17H9l3 3" />
      <circle cx="19" cy="7" r="1.6" />
      <circle cx="5" cy="17" r="1.6" />
    </>
  ),
  sobre: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
  fechar: <path d="M6 6l12 12M18 6 6 18" />,
  ocultar: (
    <>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
      <path d="M4 20 20 4" />
    </>
  ),
  olho: (
    <>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  foco: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  pasta: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  seta: <path d="m9 6 6 6-6 6" />,
  enviar: <path d="M4 12h14M13 6l6 6-6 6" />,
  estrela: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  parar: <rect x="6" y="6" width="12" height="12" rx="2" />,
  corrida: <path d="M4 6h10M4 12h14M4 18h7M17 4l3 2-3 2M21 10l-3 2 3 2" />,
  revisar: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  comentario: <path d="M4 5h16v11H9l-5 4Z" />,
  comparar: <path d="M12 3v18M4 6h5v12H4zM15 6h5v12h-5z" />,
  navegador: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M6 6.5h.5M8.5 6.5h.5" />
    </>
  ),
  menos: <path d="M5 12h14" />,
  alvo: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  arquivo: <path d="M6 3h8l4 4v14H6ZM14 3v4h4" />,
  cima: <path d="m6 15 6-6 6 6" />,
  baixo: <path d="m6 9 6 6 6-6" />,
};

export function Icone({ nome, tamanho = 16 }: { nome: keyof typeof caminhos | string; tamanho?: number }) {
  return (
    <svg className="icone" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {caminhos[nome]}
    </svg>
  );
}

export function formatarCusto(n: number) {
  return `US$ ${n.toFixed(2).replace('.', ',')}`;
}

export function formatarTokens(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')} mil`;
  return String(n);
}
