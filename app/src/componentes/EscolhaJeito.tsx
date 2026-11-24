// A escolha principal do app: Normal (os agentes do jeito deles) ou Com agentes (a equipe do Hypercube).
import { MiniVertice } from './Pecas';

export type Jeito = 'normal' | 'agentes';

export const NOME_JEITO: Record<Jeito, string> = { normal: 'Normal', agentes: 'Com agentes' };

export const DESC_JEITO: Record<Jeito, string> = {
  normal: 'Os agentes de IA no terminal, do jeito deles, lado a lado. Você manda em cada um.',
  agentes:
    'O estilo do Hypercube: o Líder põe o pedido numa lista e chama a equipe (Explorador, Construtor, Revisor, Mecânico), cada um com a sua skill, em cópias separadas, com revisão antes de entregar.',
};

/** O jeito de começar é sempre Normal (terminal padrão). Com agentes só vale se a pessoa escolher agora. */
export function lerJeito(): Jeito {
  // Limpa a escolha guardada por versões anteriores, que fazia o app abrir Com agentes.
  try {
    localStorage.removeItem('hypercube.jeito');
  } catch {
    /* sem armazenamento: nada a limpar */
  }
  return 'normal';
}

/** Dois cartões grandes, lado a lado. `compacto` deixa só o nome e uma linha (Início). */
export function EscolhaJeito({ valor, aoMudar, compacto = false }: { valor: Jeito; aoMudar: (j: Jeito) => void; compacto?: boolean }) {
  const escolher = (j: Jeito) => {
    aoMudar(j);
  };
  return (
    <div className={`jeito ${compacto ? 'jeito-compacto' : ''}`} role="radiogroup" aria-label="Como usar">
      {(['normal', 'agentes'] as Jeito[]).map((j) => (
        <button key={j} role="radio" aria-checked={valor === j} className={`jeito-cartao ${valor === j ? 'ativo' : ''}`} onClick={() => escolher(j)}>
          <span className="jeito-topo">
            {j === 'normal' ? (
              <span className="jeito-icone mono" aria-hidden="true">
                ❯_
              </span>
            ) : (
              <span className="jeito-equipe" aria-hidden="true">
                <MiniVertice papel="lider" tamanho={18} />
                <MiniVertice papel="batedor" tamanho={18} />
                <MiniVertice papel="construtor" tamanho={18} />
                <MiniVertice papel="revisor" tamanho={18} />
              </span>
            )}
            <b>{NOME_JEITO[j]}</b>
            {j === 'normal' && <span className="jeito-padrao">padrão</span>}
          </span>
          {!compacto && <span className="jeito-desc">{DESC_JEITO[j]}</span>}
        </button>
      ))}
    </div>
  );
}
