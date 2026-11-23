// Teste do Líder de ponta a ponta (só com HYPERCUBE_FUMACA e HYPERCUBE_FUMACA_LIDER_*): abre uma
// sessão de equipe, aceita sozinha os pedidos de permissão (projeto de teste) e registra no log
// cada mudança de estado dos agentes e cada resposta do Líder. No uso normal não faz nada.
import { invoke } from '@tauri-apps/api/core';
import { nativo, type Agente } from '../nativo';
import { criarSessao, criarVertice, lerEstado, mandar, nomeDoAgente, responder, type Nivel, type Papel } from './loja';

interface ConfigTeste {
  pasta: string;
  tarefa: string;
  agente: Agente;
  nivel: Nivel;
  /** Papel do primeiro agente (o Líder, se não vier). */
  papel?: Papel;
  /** Mensagens para o Líder, uma por vez, cada vez que ele termina uma resposta (separadas por ";;"). */
  depois?: string | null;
}

const umaLinha = (t: string, max = 4000) => {
  const s = t.replace(/\r/g, '').replace(/\n/g, ' ⏎ ');
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

export async function talvezTesteDoLider() {
  if (nativo.modo !== 'tauri') return;
  let c: ConfigTeste | null = null;
  try {
    c = await invoke<ConfigTeste | null>('fumaca_lider');
  } catch {
    return;
  }
  if (!c) return;
  const log = (l: string) => invoke('fumaca_registrar', { linha: `teste: ${l}` }).catch(() => {});
  const fila = (c.depois ?? '').split(';;').map((x) => x.trim()).filter(Boolean);
  const inicio = Date.now();
  const s = criarSessao('Teste do Líder', c.pasta, true, true);
  const lider = await criarVertice(s.id, c.papel ?? 'lider', c.agente, c.nivel, c.tarefa);
  log(`${c.papel ?? 'lider'} criado (${c.agente}, ${c.nivel}) id ${lider.id}`);

  const vistos = new Map<string, string>();
  const respondidos = new Set<string>();
  let liderTrabalhou = false;
  let ocupado = false;
  let ultimaTela = 0;
  window.setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      const seg = Math.round((Date.now() - inicio) / 1000);
      for (const v of lerEstado().vertices.filter((x) => x.sessaoId === s.id)) {
        const chave = `${v.encerrado ? 'encerrado' : v.estado} · ${v.ultimaAcao ?? ''}${v.pergunta ? ` · pergunta: ${v.pergunta}` : ''}`;
        if (vistos.get(v.id) !== chave) {
          vistos.set(v.id, chave);
          log(`[${seg}s] ${nomeDoAgente(v)} (${v.papel}, ${v.agente}, ${v.id}) ${chave}`);
        }
        if (v.estado === 'esperando' && v.pergunta) {
          const k = `${v.id}|${v.pergunta}|${v.esperandoDesde ?? ''}`;
          if (!respondidos.has(k)) {
            respondidos.add(k);
            log(`[${seg}s] sim automático para ${nomeDoAgente(v)}: ${v.pergunta}`);
            responder(v.id, true);
          }
        }
      }
      const l = lerEstado().vertices.find((x) => x.id === lider.id);
      if (!l) return;
      if (l.estado === 'trabalhando') liderTrabalhou = true;
      // Parado em "trabalhando" há muito tempo: guarda o fim da tela para ver o que houve.
      if (l.estado === 'trabalhando' && l.terminalId && seg - ultimaTela >= 60) {
        ultimaTela = seg;
        const tela = await nativo.terminais.historico(l.terminalId);
        log(`[${seg}s] tela de ${nomeDoAgente(l)}: ${umaLinha(tela.replace(/\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g, '').slice(-1500), 1500)}`);
      }
      if (liderTrabalhou && (l.estado === 'pronto' || l.estado === 'erro') && l.terminalId) {
        liderTrabalhou = false;
        const r = await nativo.terminais.resultado(l.terminalId);
        log(`[${seg}s] RESPOSTA DO LÍDER (ou do agente testado): ${umaLinha(r)}`);
        const proxima = fila.shift();
        if (proxima) {
          log(`[${seg}s] mensagem da pessoa para o Líder: ${proxima}`);
          mandar(l.id, proxima);
        } else {
          log(`[${seg}s] fim do roteiro de teste`);
        }
      }
    } finally {
      ocupado = false;
    }
  }, 2000);
}
