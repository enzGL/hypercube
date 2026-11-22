// O que cada papel faz de verdade: uma instrução (arquivo em src/papeis), o modelo pelo nível
// e se o agente abre só para leitura.
import lider from '../papeis/lider.md?raw';
import batedor from '../papeis/batedor.md?raw';
import construtor from '../papeis/construtor.md?raw';
import revisor from '../papeis/revisor.md?raw';
import consertador from '../papeis/consertador.md?raw';
import type { Agente } from '../nativo';
import type { Nivel, Papel } from './loja';

export const INSTRUCAO_PAPEL: Partial<Record<Papel, string>> = { lider, batedor, construtor, revisor, consertador };

/** Papéis que só leem: abrem em modo só leitura e não ganham cópia separada do projeto. */
export const SO_LEITURA: ReadonlySet<Papel> = new Set<Papel>(['batedor', 'revisor']);

/** Papéis que escrevem código e ganham a sua cópia (worktree). */
export const PRECISA_COPIA: ReadonlySet<Papel> = new Set<Papel>(['agente', 'construtor', 'consertador']);

// Só os nomes que cada programa aceita com certeza. Padrão do Gemini = "auto" (deixa ele escolher).
const MODELO: Partial<Record<Agente, Partial<Record<Nivel, string>>>> = {
  claude: { barato: 'haiku', padrao: 'sonnet', forte: 'opus' },
  gemini: { barato: 'gemini-3.5-flash', forte: 'gemini-2.5-pro' },
};

export function modeloDoNivel(agente: Agente, nivel: Nivel): string | undefined {
  return MODELO[agente]?.[nivel];
}

/** No Codex os nomes dos modelos mudam de conta para conta: o nível vira o esforço de raciocínio. */
export function esforcoDoNivel(agente: Agente, nivel: Nivel): 'low' | 'medium' | 'high' | undefined {
  if (agente !== 'codex') return undefined;
  return nivel === 'barato' ? 'low' : nivel === 'forte' ? 'high' : 'medium';
}

/**
 * Para agentes sem opção de prompt de sistema, a instrução vai junto da primeira mensagem,
 * numa linha só (no terminal, uma quebra de linha mandaria a mensagem antes da hora).
 */
export function mensagemComPapel(papel: Papel, tarefa?: string): string | undefined {
  const instrucao = INSTRUCAO_PAPEL[papel];
  if (!instrucao) return tarefa;
  const linha = instrucao.replace(/\s*\n\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return tarefa ? `${linha} Tarefa: ${tarefa}` : `${linha} Responda só "Pronto" e espere a primeira tarefa.`;
}
