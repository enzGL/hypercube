// Implementação para o Tauri 2. Cada função chama um comando Rust de mesmo nome
// (src-tauri: portable-pty, git worktree, notificação, servidor local de hooks).
// Os comandos ainda não existem: este arquivo define a forma das chamadas.
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

export function criarNativoTauri(): Nativo {
  return {
    modo: 'tauri',
    terminais: {
      criar: (opcoes) => invoke<string>('terminal_criar', { opcoes }),
      escrever: (id, dados) => invoke('terminal_escrever', { id, dados }),
      redimensionar: (id, cols, rows) => invoke('terminal_redimensionar', { id, cols, rows }),
      encerrar: (id) => invoke('terminal_encerrar', { id }),
      historico: (id) => invoke<string>('terminal_historico', { id }),
      aoReceber: (id, ouvinte) => ouvir<string>(`terminal:${id}`, ouvinte),
    },
    eventos: {
      aoEvento: (ouvinte) => ouvir<EventoAgente>('hook:evento', ouvinte),
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
