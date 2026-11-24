// Instalar os agentes de IA pelo próprio app: um terminal do Hypercube roda o comando oficial.
import { useSyncExternalStore } from 'react';
import { nativo, type Agente } from '../nativo';

/** Agentes que valem a pena e como instalar (comandos oficiais pelo npm). Lugar único: a introdução e os diálogos usam este mapa. */
export const INSTALACAO: Partial<Record<Agente, { desc: string; comando?: string; site: string }>> = {
  claude: { desc: 'Da Anthropic. Ótimo para planejar.', comando: 'npm install -g @anthropic-ai/claude-code', site: 'https://docs.anthropic.com/en/docs/claude-code' },
  codex: { desc: 'Da OpenAI. Rápido no código.', comando: 'npm install -g @openai/codex', site: 'https://github.com/openai/codex' },
  gemini: { desc: 'Do Google. Tem cota grátis.', comando: 'npm install -g @google/gemini-cli', site: 'https://github.com/google-gemini/gemini-cli' },
  opencode: { desc: 'Aberto. Usa vários modelos.', comando: 'npm install -g opencode-ai', site: 'https://opencode.ai' },
  kiro: { desc: 'Da AWS. Parte de especificações.', site: 'https://kiro.dev' },
};

/** Site oficial do Node.js (traz o npm). */
export const SITE_NODE = 'https://nodejs.org';

/** Código de saída quando o computador não tem npm (o mesmo do Windows para "comando não encontrado"). */
const SEM_NPM = 9009;

export type EstadoInstalacao =
  | { fase: 'instalando'; terminalId: string }
  | { fase: 'instalado' }
  | { fase: 'erro'; terminalId: string; mensagem: string }
  | { fase: 'sem-node' };

let estados: Partial<Record<Agente, EstadoInstalacao>> = {};
const ouvintes = new Set<() => void>();
const pendentes = new Map<string, Agente>();
const aoTerminar = new Set<() => void>();

function definir(agente: Agente, e: EstadoInstalacao | undefined) {
  estados = { ...estados, [agente]: e };
  ouvintes.forEach((o) => o());
}

export function useInstalacao(): Partial<Record<Agente, EstadoInstalacao>> {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estados,
  );
}

/** Avisa quem mostra a lista de agentes que ela mudou (para procurar de novo). */
export function aoTerminarInstalacao(f: () => void): () => void {
  aoTerminar.add(f);
  return () => aoTerminar.delete(f);
}

/**
 * Roda o comando oficial num terminal do Hypercube (PowerShell). Sem npm, sai com 9009
 * para o app avisar que falta o Node. No fim procura os agentes de novo.
 */
export async function instalarAgente(agente: Agente) {
  const comando = INSTALACAO[agente]?.comando;
  if (!comando) return;
  const linha = `if (Get-Command npm -ErrorAction SilentlyContinue) { ${comando}; exit $LASTEXITCODE } else { Write-Host 'O npm não foi encontrado: instale o Node.js primeiro.'; exit ${SEM_NPM} }`;
  try {
    const terminalId = await nativo.terminais.criar({ agente: 'terminal', pasta: '.', rotulo: `Instalar ${agente}`, tarefa: linha });
    pendentes.set(terminalId, agente);
    definir(agente, { fase: 'instalando', terminalId });
  } catch (erro) {
    definir(agente, { fase: 'erro', terminalId: '', mensagem: String(erro) });
  }
}

nativo.eventos.aoFim(async ({ id, codigo }) => {
  const agente = pendentes.get(id);
  if (!agente) return;
  pendentes.delete(id);
  if (codigo === SEM_NPM) {
    definir(agente, { fase: 'sem-node' });
    return;
  }
  const achados = await nativo.processos.detectarAgentes(true).catch(() => []);
  const ok = achados.some((a) => a.agente === agente && a.instalado);
  definir(agente, ok ? { fase: 'instalado' } : { fase: 'erro', terminalId: id, mensagem: codigo === 0 ? 'O comando terminou, mas o agente não apareceu. Feche e abra o app.' : `O comando terminou com erro (código ${codigo}).` });
  aoTerminar.forEach((f) => f());
});
