// Ícones da casca (barra de cima, lateral e painel direito). Desenhados aqui, traço 1.5 px.
import type { ReactNode } from 'react';

const desenhos: Record<string, ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  lateral: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
    </>
  ),
  painelDireito: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M14.5 4.5v15" />
    </>
  ),
  voltar: <path d="M14.5 6 8.5 12l6 6" />,
  avancar: <path d="m9.5 6 6 6-6 6" />,
  baixo: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  inicio: (
    <>
      <path d="M4 11 12 4.5 20 11" />
      <path d="M6 9.5V19h4.5v-5h3v5H18V9.5" />
    </>
  ),
  grade: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  pasta: <path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />,
  novaPasta: (
    <>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
      <path d="M12 10.5v5M9.5 13h5" />
    </>
  ),
  git: (
    <>
      <circle cx="7" cy="5.5" r="2" />
      <circle cx="7" cy="18.5" r="2" />
      <circle cx="17" cy="8.5" r="2" />
      <path d="M7 7.5v9M17 10.5c0 4-10 2.5-10 6" />
    </>
  ),
  bot: (
    <>
      <rect x="5" y="8" width="14" height="11" rx="3" />
      <path d="M12 4v4M9.5 13v1.5M14.5 13v1.5" />
    </>
  ),
  busca: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m19.5 19.5-4.2-4.2" />
    </>
  ),
  mais: <path d="M12 5.5v13M5.5 12h13" />,
  fechar: <path d="m7 7 10 10M17 7 7 17" />,
  notas: (
    <>
      <path d="M6.5 3.5h8l3 3v14h-11Z" />
      <path d="M9 10h6M9 13.5h6M9 17h3.5" />
    </>
  ),
  tarefas: (
    <>
      <path d="m4 7 1.8 1.8L9 5.5M4 15l1.8 1.8L9 13.5" />
      <path d="M12 7.5h8M12 15.5h8" />
    </>
  ),
  plugins: (
    <>
      <path d="M9 3.5v4M15 3.5v4" />
      <path d="M6.5 7.5h11v3.5a5.5 5.5 0 0 1-11 0Z" />
      <path d="M12 16.5v4" />
    </>
  ),
  orquestracao: (
    <>
      <circle cx="6" cy="6.5" r="2.2" />
      <circle cx="18" cy="6.5" r="2.2" />
      <circle cx="12" cy="17.5" r="2.2" />
      <path d="M8.2 6.5h7.6M7.2 8.4l3.7 7.2M16.8 8.4l-3.7 7.2" />
    </>
  ),
  engrenagem: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6" />
    </>
  ),
  memoria: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
      <path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" />
    </>
  ),
  estrela: <path d="m12 4 2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.8l5.4-.8Z" />,
  lixeira: (
    <>
      <path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7" />
      <path d="M10.5 10.5v5.5M13.5 10.5v5.5" />
    </>
  ),
  tocar: <path d="M8 5.5v13l10-6.5Z" />,
  pausar: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  zerar: (
    <>
      <path d="M5 12a7 7 0 1 0 2.1-5" />
      <path d="M5 4.5V9h4.5" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 9.5V13l2.5 1.5M9.5 3.5h5" />
    </>
  ),
  alvo: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  terminal: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="m7.5 9.5 3 2.5-3 2.5M12.5 15h4" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 12h16M12 4v16" />
    </>
  ),
  imagens: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m3.5 17 5-4.5 4 3 3-2.5 5 4" />
    </>
  ),
  roteador: (
    <>
      <path d="M4 8h12.5l-3-3M20 16H7.5l3 3" />
    </>
  ),
  sobre: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </>
  ),
};

export function IconeCasca({ nome, tamanho = 16 }: { nome: keyof typeof desenhos | string; tamanho?: number }) {
  return (
    <svg
      className="icone"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {desenhos[nome]}
    </svg>
  );
}

/** Avatar do projeto: quadrado na cor do projeto com a inicial. */
export function AvatarProjeto({ nome, cor, tamanho = 18 }: { nome: string; cor: string; tamanho?: number }) {
  return (
    <span className="avatar-projeto" style={{ width: tamanho, height: tamanho, background: cor, fontSize: Math.round(tamanho * 0.56) }} aria-hidden="true">
      {nome.trim().charAt(0).toUpperCase()}
    </span>
  );
}
