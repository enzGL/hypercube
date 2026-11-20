// Implementação para o Tauri 2. Cada função chama um comando Rust de mesmo nome
// (app/src-tauri: portable-pty, servidor local de hooks, git worktree, notificação, diálogo).
// Eventos que vêm do Rust: `terminal_saida` ({ id, dados }), `terminal_fim` ({ id, codigo })
// e `evento_agente` (EventoAgente).
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { Desligar, EventoAgente, Nativo, SaidaGerada } from './tipos';

/** Liga um ouvinte de evento do Tauri e devolve um desligar síncrono. */
function ouvir<T>(canal: string, ouvinte: (dado: T) => void): Desligar {
  let desligar: UnlistenFn | null = null;
  let cancelado = false;
  listen<T>(canal, (e) => ouvinte(e.payload)).then((fn) => {
    if (cancelado) fn();
    else desligar = fn;
  });
  return () => {
    cancelado = true;
    desligar?.();
  };
}

interface Saida {
  id: string;
  dados: string;
}

interface Fim {
  id: string;
  codigo: number;
}

// Um só ouvinte de `terminal_saida` para todos os terminais; cada um recebe só o que é dele.
const ouvintesSaida = new Map<string, Set<(dados: string) => void>>();
let saidaLigada = false;

function ligarSaida() {
  if (saidaLigada) return;
  saidaLigada = true;
  listen<Saida>('terminal_saida', (e) => {
    ouvintesSaida.get(e.payload.id)?.forEach((f) => f(e.payload.dados));
  });
  listen<Fim>('terminal_fim', (e) => {
    ouvintesSaida
      .get(e.payload.id)
      ?.forEach((f) => f(`\r\n\x1b[2m[processo encerrado · código ${e.payload.codigo}]\x1b[0m\r\n`));
  });
}

export function criarNativoTauri(): Nativo {
  ligarSaida();
  return {
    modo: 'tauri',
    terminais: {
      criar: (opcoes) => invoke<string>('terminal_criar', { opcoes }),
      escrever: (id, dados) => invoke('terminal_escrever', { id, dados }),
      redimensionar: (id, cols, rows) => invoke('terminal_redimensionar', { id, cols, rows }),
      encerrar: (id) => invoke('terminal_encerrar', { id }),
      historico: (id) => invoke<string>('terminal_historico', { id }),
      aoReceber: (id, ouvinte) => {
        let lista = ouvintesSaida.get(id);
        if (!lista) ouvintesSaida.set(id, (lista = new Set()));
        const minha = lista;
        minha.add(ouvinte);
        return () => {
          minha.delete(ouvinte);
          if (!minha.size && ouvintesSaida.get(id) === minha) ouvintesSaida.delete(id);
        };
      },
    },
    eventos: {
      aoEvento: (ouvinte) => ouvir<EventoAgente>('evento_agente', ouvinte),
    },
    arquivos: {
      escolherPasta: () => invoke<string | null>('arquivos_escolher_pasta'),
      ler: (caminho) => invoke<string>('arquivos_ler', { caminho }),
      observarSaidas: (pasta, ouvinte) => {
        invoke('arquivos_observar_saidas', { pasta });
        return ouvir<SaidaGerada>('saidas:nova', ouvinte);
      },
    },
    processos: {
      detectarAgentes: () => invoke('processos_detectar_agentes'),
      usoDoPlano: () => invoke('processos_uso_do_plano'),
      criarWorktree: (pasta, ramo) => invoke<string>('processos_criar_worktree', { pasta, ramo }),
    },
    sistema: {
      notificar: (titulo, corpo) => invoke('sistema_notificar', { titulo, corpo }),
      tocarSom: () => void invoke('sistema_tocar_som'),
      definirTitulo: (titulo) => void invoke('sistema_definir_titulo', { titulo }),
      abrirLink: (url) => void invoke('sistema_abrir_link', { url }),
      portaCanvas: () => invoke<number>('sistema_porta_canvas'),
    },
    roteador: {
      estado: () => invoke('roteador_estado'),
      ligar: (ligado) => invoke('roteador_ligar', { ligado }),
      salvarCadeia: (nivel, provedores) => invoke('roteador_salvar_cadeia', { nivel, provedores }),
    },
  };
}
