// O que cada papel faz de verdade: uma instrução (arquivo em src/papeis), o modelo pelo nível
// e se o agente abre só para leitura.
import comum from '../papeis/_comum.md?raw';
import lider from '../papeis/lider.md?raw';
import batedor from '../papeis/batedor.md?raw';
import construtor from '../papeis/construtor.md?raw';
import revisor from '../papeis/revisor.md?raw';
import consertador from '../papeis/consertador.md?raw';
import type { Agente } from '../nativo';
import type { Nivel, Papel } from './loja';

/** Regras de todos os papéis (entrega na última mensagem, provas, limites) + as do papel. */
export function juntarInstrucao(papel: string): string {
  return `${comum.trim()}\n\n---\n\n${papel.trim()}\n`;
}

export const INSTRUCAO_PAPEL: Partial<Record<Papel, string>> = {
  lider: juntarInstrucao(lider),
  batedor: juntarInstrucao(batedor),
  construtor: juntarInstrucao(construtor),
  revisor: juntarInstrucao(revisor),
  consertador: juntarInstrucao(consertador),
};

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
 * A tarefa vem primeiro e é repetida no fim, para não se perder num texto longo; a estrutura
 * do papel vira marcas legíveis numa linha (ver umaLinha).
 * O caminho melhor (o papel inteiro por fora da conversa, no Codex e no Gemini) depende de
 * terminais.rs: ver docs/skills/RELATORIO.md.
 */
export function mensagemComPapel(papel: Papel, tarefa?: string): string | undefined {
  const instrucao = INSTRUCAO_PAPEL[papel];
  if (!instrucao) return tarefa;
  const regras = umaLinha(instrucao);
  const t = tarefa ? umaLinha(tarefa) : '';
  return t
    ? `TAREFA: ${t} ### Siga as regras do seu papel: ### ${regras} ### Lembrete da TAREFA: ${t}`
    : `${regras} ### Responda só "Pronto" e espere a primeira tarefa.`;
}

/**
 * Achata markdown numa linha sem perder a estrutura: "## Título" vira "[Título]", item de lista
 * vira "•", e cada bloco ``` (o formato de entrega) fica entre <<FORMATO e FORMATO>>, com " / "
 * marcando onde eram as linhas.
 */
export function umaLinha(md: string): string {
  const partes: string[] = [];
  let noBloco = false;
  for (const bruta of md.replace(/\r/g, '').split('\n')) {
    const l = bruta.trim();
    if (l.startsWith('```')) {
      partes.push(noBloco ? 'FORMATO>>' : '<<FORMATO');
      noBloco = !noBloco;
    } else if (!l || l === '---') {
      continue;
    } else if (noBloco) {
      partes.push(`${l} /`);
    } else {
      const titulo = l.match(/^#{1,6}\s+(.*)$/);
      partes.push(titulo ? `[${titulo[1]}]` : l.replace(/^[-*]\s+/, '• '));
    }
  }
  return partes.join(' ').replace(/ \/ FORMATO>>/g, ' FORMATO>>').replace(/\s+/g, ' ').trim();
}
