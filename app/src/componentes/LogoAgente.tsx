// Logo de cada agente (arquivos em public/agentes, pacote MIT da LobeHub). O terminal comum usa um ícone próprio.
import type { Agente } from '../nativo';

const COM_LOGO = new Set(['claude', 'codex', 'gemini', 'kiro', 'opencode']);

export function LogoAgente({ agente, tamanho = 16, className = '' }: { agente: Agente | string; tamanho?: number; className?: string }) {
  if (COM_LOGO.has(agente)) {
    return (
      <img
        className={`logo-agente ${className}`}
        src={`./agentes/${agente}.svg`}
        alt=""
        aria-hidden="true"
        width={tamanho}
        height={tamanho}
        draggable={false}
      />
    );
  }
  return (
    <svg className={`logo-agente ${className}`} viewBox="0 0 16 16" width={tamanho} height={tamanho} aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="var(--texto-2)" strokeWidth="1.3" />
      <path d="m4.5 6 2 2-2 2M8.5 10.5h3" fill="none" stroke="var(--texto-2)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
