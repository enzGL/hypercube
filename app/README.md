# Hypercube

Todos os seus agentes, num cubo só.

O Hypercube junta numa janela todas as sessões dos seus agentes de IA no terminal (Claude Code, Codex, Gemini CLI, Kiro, OpenCode ou um terminal comum). Cada agente é um **agente** com um papel (líder, batedor, construtor, revisor, consertador) e o **Hiper**, o mascote, mostra como está tudo.

**É grátis para usar. Só pedimos que você dê uma estrela no GitHub!** https://github.com/enzGL/hypercube

## Telas

- **Primeira abertura:** o Hiper procura os agentes instalados; abra uma pasta ou explore com um exemplo.
- **Barra lateral:** Hiper com o estado geral, telas, projetos agrupados por pasta, sessões com contador de agentes e subagentes embaixo do agente pai e "Nova sessão".
- **Sessões:** grade de terminais, um por agente. Layouts automático, foco e grade livre (arraste para reordenar). Fechar o painel só esconde: o processo continua. Faixa de permissão (Permitir/Negar), corrida (`/corrida 3 tarefa`), revisão cruzada (`/revisar`) e campo de comando embaixo.
- **Orquestração:** canvas com os agentes como nós e ligações com condições (testes passaram, custo, cota). Roteiros prontos, nível barato/padrão/forte, limite de custo por rodada, entregas `resultado.md`, `saida.json`, `diff.patch`.
- **Imagens:** quadro infinito com o que os agentes salvam em `.hypercube/saidas/`. HTML isolado, artboards lado a lado, comparar versões e comentar num ponto da imagem para mandar ao agente.
- **Roteador:** provedores gratuitos, chamadas do dia, cadeias editáveis por nível.
- **Sobre:** versão e licença.

Estados, sempre com forma e cor: ◐ trabalhando, ◆ esperando você, ● pronto, ✕ erro. Atalho `Alt+N` vai para quem espera há mais tempo; o título da janela mostra quantos esperam.

## Como está organizado

```
src/
  nativo/        acesso a terminais, arquivos e processos
    tipos.ts     o contrato
    simulado.ts  versão simulada (hoje)
    tauri.ts     chamadas para os comandos Rust do Tauri 2
    index.ts     escolhe a versão certa
  estado/        sessões, agentes, avisos
  componentes/   barra lateral, barra de cima, terminal, Hiper, diálogos
  telas/         sessões, orquestração, imagens, roteador, sobre, primeira abertura
```

A interface só fala com o sistema por `src/nativo`. Dentro do Tauri 2 (`__TAURI_INTERNALS__` presente) ela usa `tauri.ts`; no navegador usa a versão simulada.

Abra com `?exemplo` para pular a primeira abertura (e `&tela=orquestracao`, `&sessao=Ideias`).

## Comandos

```
npm install
npm run dev            # só a interface, com o sistema simulado (porta 5184)
npm run tauri:dev      # app de verdade (Tauri 2) com recarga
npm run tauri:build    # instalador (src-tauri/target/release/bundle)
npx tauri build --debug   # exe de teste em src-tauri/target/debug/hypercube.exe
```

O lado nativo fica em `src-tauri/` (Rust): terminais com portable-pty, servidor local de hooks
do Claude Code (só 127.0.0.1, token aleatório, recusa `Origin`), detecção de agentes, git worktree,
notificação e escolha de pasta. Os hooks entram por um settings temporário passado com `--settings`;
o `~/.claude/settings.json` do usuário não é tocado.

Teste de fumaça: `HYPERCUBE_FUMACA=fumaca.log HYPERCUBE_FUMACA_SAIR=1 src-tauri/target/debug/hypercube.exe`
abre a janela no segundo monitor, detecta os agentes, confere o servidor de hooks e um terminal, grava o log e fecha.
Com `HYPERCUBE_FUMACA_CLAUDE=<pasta>` também abre o Claude Code num PTY e espera o `SessionStart` chegar pelo hook (sem mandar prompt).

## Licença

MIT. O nome "Hypercube", o mascote Hiper e a logo não fazem parte da licença.
