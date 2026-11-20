# Handoff — onde paramos

Atualizado em 2026-11-20.

## O que foi feito

### Design (etapa 0 — concluída)
- Logo "Oito Vértices" em dither cobalto: `design/logo/`
- Mascote Hiper aprovado: `design/mascote/hiper-escolhido.dc.html`
- Direção visual "Noite" aprovada (escuro, cobalto, Libre Baskerville)

### Frontend (etapa 0.1 — código gerado, falta Tauri real)
- App React + TypeScript + Vite em `app/`
- Commit: `a248f31` — "Hypercube 0.1 — frontend React+TS+Vite"

**Telas implementadas:**
- `PrimeiraAbertura` — Hiper se apresenta, detecta agentes instalados, abre pasta ou exemplo
- `Sessoes` — grade de terminais (xterm.js), layouts auto/foco/livre, ocultar ≠ encerrar, barra de permissão, /corrida, /revisar, Alt+N
- `Orquestracao` — canvas com @xyflow/react, nós por papel, condições, roteiros editáveis, custos
- `Imagens` — quadro infinito, comparar versões, comentar, abrir no navegador
- `Roteador` — provedores, níveis barato/padrão/forte, log de chamadas
- `Sobre`

**Componentes:**
- `Hiper.tsx` — SVG exato do mascote aprovado, 5 estados (repouso, atenção, processando, sucesso, erro)
- `BarraLateral.tsx` — projetos agrupados por pasta, sessões com contagem de Vértices, subagentes aninhados, rodapé com estrela GitHub
- `BarraTopo.tsx` — contadores ao vivo, uso do plano Claude e Codex
- `Terminal.tsx` — wrapper xterm.js
- `Pecas.tsx` — peças reutilizáveis
- `Dialogos.tsx` — Nova sessão, Novo Vértice

**Camada nativo (`src/nativo/`):**
- `tipos.ts` — contrato de tipos (interface com Tauri)
- `simulado.ts` — implementação simulada ativa (agentes com scripts, estado ao vivo)
- `tauri.ts` — implementação Tauri pronta para substituir a simulada
- `index.ts` — exporta a versão correta conforme o ambiente

**Estado (`src/estado/loja.ts`):**
- Zustand-like com `useSyncExternalStore`
- Eventos: SessionStart, UserPromptSubmit, PreToolUse, Notification, Stop, SubagentStart/Stop
- Corrida, revisão cruzada, Alt+N, `restaurarConfig` (persiste sessão no localStorage)

**Verificação do craft-anything:**
- Build passou ✓
- Screenshot passou ✓ (1440×900, lançador Rust temporário em `lancador/main.rs`)
- Scan do app de referência concluído: visual e fluxos reproduzidos fielmente
- Nenhuma referência ao app original no código ✓

## Próximo passo — etapa 0.1 real (Tauri 2)

Substituir `src/nativo/simulado.ts` pela implementação real. O contrato já está em `tipos.ts`; basta implementar `tauri.ts` e trocar o `index.ts` para usá-lo.

**O que implementar em Tauri 2 (`src-tauri/`):**

1. **Terminais PTY reais** — comando Rust `terminal_criar(agente, pasta, rotulo)` que abre um PTY com node-pty ou portable-pty; `terminal_escrever(id, texto)`; `terminal_encerrar(id)`; evento `terminal_saida` emitido para o frontend via `emit`.

2. **Hooks HTTP do Claude Code** — servidor HTTP em `127.0.0.1:<porta>` com token aleatório que recebe `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `Notification`, `Stop`, `SubagentStart`, `SubagentStop` e os emite para o frontend via `emit('evento_agente', payload)`. O frontend já consome em `nativo/tauri.ts`.

3. **Detectar agentes** — `processos_detectar_agentes()` que roda `claude --version`, `codex --version`, `gemini --version`, `kiro --version`, `opencode --version` e retorna lista com instalado/versão.

4. **Worktrees** — `processos_criar_worktree(pasta, nome)` que roda `git worktree add`.

5. **Sistema** — `sistema_definir_titulo(t)`, `sistema_notificar(titulo, corpo)`, `sistema_tocar_som()`.

6. **Arquivos** — `arquivos_escolher_pasta()` → dialog do Tauri.

**Critério de pronto da etapa 0.1:**
3 sessões do Claude Code rodando em paralelo com estado ao vivo (◐ trabalhando, ◆ esperando, ● pronto) e o Hiper reagindo aos eventos.

## Arquivos importantes

| Arquivo | O que é |
|---|---|
| `app/src/nativo/tipos.ts` | Contrato de tipos — não mudar sem motivo |
| `app/src/nativo/simulado.ts` | Implementação simulada atual |
| `app/src/nativo/tauri.ts` | Implementação Tauri — completar aqui |
| `app/src/nativo/index.ts` | Troca simulado ↔ tauri conforme env |
| `app/src/estado/loja.ts` | Estado global, eventos, ações |
| `app/lancador/main.rs` | Lançador temporário (abre no Edge/Chrome) — remover quando Tauri estiver pronto |
| `design/mascote/hiper-escolhido.dc.html` | SVG fonte do Hiper — não alterar |
| `design/logo/hypercube-dark.png` | Logo pixel art usada no app |

## Regras que não mudam

- Código nosso ou licença MIT/Apache instalada por npm/cargo. Sem copiar de outros apps.
- Interface em português do Brasil.
- Nome do pacote: `hypercube`. Nenhum arquivo cita o app de referência.
- Licença MIT. Nome "Hypercube", Hiper e logo não entram na licença.
