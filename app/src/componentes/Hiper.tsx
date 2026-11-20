// Hiper, o mascote do Hypercube: cubo em 3 tons dentro da projeção com 6 ligações.
// SVG e animações iguais ao mascote aprovado (5 estados). Abaixo de 32 px fica só o cubo.
import type { EstadoHiper } from '../estado/loja';

interface Props {
  estado?: EstadoHiper;
  tamanho?: number;
  rotulo?: string;
}

export function Hiper({ estado = 'repouso', tamanho = 96, rotulo = 'Hiper, o assistente do Hypercube' }: Props) {
  if (tamanho < 32) {
    return (
      <span className="m" data-e={estado} style={{ width: tamanho, display: 'inline-block' }} role="img" aria-label={rotulo}>
        <svg viewBox="40 34 120 128" aria-hidden="true" style={{ display: 'block', width: '100%', height: 'auto' }}>
          <path d="M100 42 L150 70 L100 98 L50 70 Z" fill="#7385F0" stroke="#7385F0" strokeWidth="12" strokeLinejoin="round" />
          <path d="M50 70 L100 98 L100 154 L50 126 Z" fill="#2238C4" stroke="#2238C4" strokeWidth="12" strokeLinejoin="round" />
          <path d="M150 70 L100 98 L100 154 L150 126 Z" fill="#1A2C9E" stroke="#1A2C9E" strokeWidth="12" strokeLinejoin="round" />
          <ellipse cx="78" cy="114" rx="7.5" ry="10.5" fill="#FFFFFF" />
          <ellipse cx="122" cy="114" rx="7.5" ry="10.5" fill="#FFFFFF" />
        </svg>
      </span>
    );
  }
  return (
    <div className="m" data-e={estado} style={{ width: tamanho }}>
      <svg viewBox="0 0 200 200" role="img" aria-label={rotulo}>
        <ellipse className="sombra" cx="100" cy="194" rx="44" ry="5.5" fill="#000" opacity=".12" />
        <g className="flutua">
          <g className="pulo">
            <g className="aro" fill="none" stroke="#8C9BF0" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M100 20L170 59L170 137L100 176L30 137L30 59Z" />
              <path d="M100 20L100 42M170 59L150 70M170 137L150 126M100 176L100 154M30 137L50 126M30 59L50 70" />
            </g>
            <path d="M100 42 L150 70 L100 98 L50 70 Z" fill="#7385F0" stroke="#7385F0" strokeWidth="12" strokeLinejoin="round" />
            <path d="M50 70 L100 98 L100 154 L50 126 Z" fill="#2238C4" stroke="#2238C4" strokeWidth="12" strokeLinejoin="round" />
            <path d="M150 70 L100 98 L100 154 L150 126 Z" fill="#1A2C9E" stroke="#1A2C9E" strokeWidth="12" strokeLinejoin="round" />
            <g className="f-normal">
              <g className="olhar">
                <ellipse className="olho" cx="78" cy="114" rx="6.5" ry="9.5" fill="#FFFFFF" />
                <ellipse className="olho" cx="122" cy="114" rx="6.5" ry="9.5" fill="#FFFFFF" />
              </g>
            </g>
            <g className="f-feliz" fill="none" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round">
              <path d="M71 116q7-9 14 0" />
              <path d="M115 116q7-9 14 0" />
            </g>
            <g className="sobr" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round">
              <path d="M70 100l13-4" />
              <path d="M117 96l13 4" />
            </g>
            <g className="x-proc" fill="#E9A21B">
              <circle cx="164" cy="22" r="4.5" />
              <circle cx="176" cy="14" r="4.5" />
              <circle cx="188" cy="6" r="4.5" />
            </g>
            <g className="x-suc">
              <path d="M22 18Q22 26 30 26Q22 26 22 34Q22 26 14 26Q22 26 22 18Z" fill="#E9A21B" />
              <path d="M184 30Q184 36 190 36Q184 36 184 42Q184 36 178 36Q184 36 184 30Z" fill="#7385F0" />
              <path d="M20 166Q20 171 25 171Q20 171 20 176Q20 171 15 171Q20 171 20 166Z" fill="#E9A21B" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

export const FRASE_HIPER: Record<EstadoHiper, string> = {
  repouso: 'Tudo calmo por aqui.',
  atencao: 'Alguém precisa de você.',
  processando: 'Os Vértices estão trabalhando.',
  sucesso: 'Tarefa concluída!',
  erro: 'Algo deu errado.',
};
