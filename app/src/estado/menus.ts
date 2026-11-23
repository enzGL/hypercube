// Itens do menu do clique direito em cada lugar do app. Só usa ações que já existem na loja.
import { createElement } from 'react';
import { Icone } from '../componentes/Pecas';
import type { EntradaMenu } from '../componentes/MenuContexto';
import { nativo } from '../nativo';
import { fecharAbaProjeto, irParaRota } from './casca';
import {
  abrirDialogo,
  alternarPasta,
  definirOrquestracao,
  encerrar,
  encerrarSessao,
  focar,
  lerEstado,
  nomeDoAgente,
  ocultar,
  reabrir,
  reabrirTodos,
  selecionarSessao,
  type Sessao,
  type Vertice,
} from './loja';

const ic = (nome: string) => createElement(Icone, { nome, tamanho: 14 });

function copiar(texto: string) {
  navigator.clipboard?.writeText(texto).catch(() => {});
}

function abrirPasta(caminho: string) {
  nativo.sistema.abrirPasta(caminho).catch(() => {});
}

/** Pede ao campo de comando da sessão para mirar num agente (ou em todos) e ganhar o foco. */
export const EVENTO_CAMPO = 'hypercube:campo';
/** Pede ao painel do agente para abrir a edição do nome ali mesmo. */
export const EVENTO_RENOMEAR = 'hypercube:renomear';

function irParaSessao(sessaoId: string) {
  selecionarSessao(sessaoId);
  if (lerEstado().tela !== 'sessoes') irParaRota('sessoes');
}

function mirarCampo(sessaoId: string, alvo: string) {
  irParaSessao(sessaoId);
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(EVENTO_CAMPO, { detail: { sessaoId, alvo } })), 60);
}

export function menuProjeto(pasta: string, aberta: boolean): EntradaMenu[] {
  return [
    { rotulo: 'Nova sessão aqui', icone: ic('mais'), acao: () => abrirDialogo({ tipo: 'novaSessao', pasta }) },
    { rotulo: 'Abrir pasta no explorador', icone: ic('pasta'), acao: () => abrirPasta(pasta) },
    { rotulo: 'Copiar caminho', icone: ic('arquivo'), acao: () => copiar(pasta) },
    'separador',
    { rotulo: aberta ? 'Recolher' : 'Expandir', icone: ic(aberta ? 'cima' : 'baixo'), acao: () => alternarPasta(pasta) },
    { rotulo: 'Fechar projeto', icone: ic('fechar'), acao: () => fecharAbaProjeto(pasta) },
  ];
}

export function menuSessao(s: Sessao): EntradaMenu[] {
  const e = lerEstado();
  const vs = e.vertices.filter((v) => v.sessaoId === s.id && !v.paiId);
  const fechados = vs.filter((v) => v.encerrado).length;
  const comAgentes = s.orquestracao !== false;
  return [
    { rotulo: 'Novo agente', icone: ic('mais'), acao: () => abrirDialogo({ tipo: 'novoVertice', sessaoId: s.id }) },
    { rotulo: 'Renomear', icone: ic('comentario'), atalho: 'F2', acao: () => abrirDialogo({ tipo: 'renomearSessao', sessaoId: s.id }) },
    {
      rotulo: comAgentes ? 'Mudar para Normal' : 'Mudar para Com agentes',
      icone: ic('orquestracao'),
      acao: () => definirOrquestracao(s.id, !comAgentes),
    },
    { rotulo: 'Abrir a orquestração', icone: ic('orquestracao'), acao: () => (selecionarSessao(s.id), irParaRota('orquestracao')) },
    ...(fechados ? [{ rotulo: `Abrir todos de novo (${fechados})`, icone: ic('seta'), acao: () => reabrirTodos(s.id) }] : []),
    { rotulo: 'Mandar para todos…', icone: ic('enviar'), desativado: !vs.some((v) => !v.encerrado), acao: () => mirarCampo(s.id, 'todos') },
    'separador',
    {
      rotulo: 'Encerrar a sessão',
      icone: ic('parar'),
      perigo: true,
      confirmar: `Clique de novo: encerra ${vs.length} ${vs.length === 1 ? 'agente' : 'agentes'}`,
      acao: () => encerrarSessao(s.id),
    },
  ];
}

export function menuAgente(v: Vertice, abrirApelido: () => void): EntradaMenu[] {
  const e = lerEstado();
  const sessao = e.sessoes.find((s) => s.id === v.sessaoId);
  const pasta = v.worktree ?? sessao?.pasta;
  const branch = v.worktree ? `v/${v.worktree.split(/[\\/]/).pop()}` : undefined;
  return [
    { rotulo: 'Focar', icone: ic('foco'), acao: () => (irParaSessao(v.sessaoId), focar(v.id)) },
    { rotulo: 'Apelido e cor', icone: ic('estrela'), acao: abrirApelido },
    {
      rotulo: 'Renomear',
      icone: ic('comentario'),
      atalho: 'F2',
      acao: () => {
        irParaSessao(v.sessaoId);
        focar(v.id);
        window.setTimeout(() => window.dispatchEvent(new CustomEvent(EVENTO_RENOMEAR, { detail: v.id })), 60);
      },
    },
    { rotulo: 'Mandar tarefa…', icone: ic('enviar'), desativado: !!v.encerrado, acao: () => mirarCampo(v.sessaoId, v.id) },
    { rotulo: v.oculto ? 'Mostrar' : 'Ocultar', icone: ic(v.oculto ? 'olho' : 'ocultar'), acao: () => ocultar(v.id, !v.oculto) },
    ...(v.encerrado ? [{ rotulo: 'Abrir de novo', icone: ic('seta'), acao: () => reabrir(v.id) }] : []),
    'separador',
    ...(pasta ? [{ rotulo: v.worktree ? 'Abrir a cópia dele' : 'Abrir a pasta', icone: ic('pasta'), acao: () => abrirPasta(pasta) }] : []),
    ...(branch ? [{ rotulo: `Copiar branch (${branch})`, icone: ic('arquivo'), acao: () => copiar(branch) }] : []),
    'separador',
    {
      rotulo: 'Encerrar',
      icone: ic('fechar'),
      perigo: true,
      confirmar: `Clique de novo: encerrar ${nomeDoAgente(v)}`,
      desativado: !!v.encerrado && !v.terminalId,
      acao: () => encerrar(v.id),
    },
  ];
}

export function menuVazio(): EntradaMenu[] {
  const e = lerEstado();
  const sessao = e.sessoes.find((s) => s.id === e.sessaoAtivaId);
  return [
    { rotulo: 'Nova sessão', icone: ic('mais'), acao: () => abrirDialogo({ tipo: 'novaSessao' }) },
    { rotulo: 'Novo agente', icone: ic('mais'), desativado: !sessao, acao: () => sessao && abrirDialogo({ tipo: 'novoVertice', sessaoId: sessao.id }) },
  ];
}
