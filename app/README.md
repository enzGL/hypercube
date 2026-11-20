# Hypercube

Todos os seus agentes, num cubo só.

O Hypercube junta numa janela todas as sessões dos seus agentes de IA no terminal (Claude Code, Codex, Gemini CLI, Kiro, OpenCode ou um terminal comum). Cada agente é um **Vértice** com um papel (líder, batedor, construtor, revisor, consertador) e o **Hiper**, o mascote, mostra como está tudo.

**É grátis para usar. Só pedimos que você dê uma estrela no GitHub!** https://github.com/enzGL/hypercube

## Telas

- **Primeira abertura:** o Hiper procura os agentes instalados; abra uma pasta ou explore com um exemplo.
- **Barra lateral:** Hiper com o estado geral, telas, projetos agrupados por pasta, sessões com contador de Vértices e subagentes embaixo do agente pai, "Nova sessão" e o pedido de estrela.
- **Sessões:** grade de terminais, um por Vértice. Layouts automático, foco e grade livre (arraste para reordenar). Fechar o painel só esconde: o processo continua. Faixa de permissão (Permitir/Negar), corrida (`/corrida 3 tarefa`), revisão cruzada (`/revisar`) e campo de comando embaixo.
- **Orquestração:** canvas com os Vértices como nós e ligações com condições (testes passaram, custo, cota). Roteiros prontos, nível barato/padrão/forte, limite de custo por rodada, entregas `resultado.md`, `saida.json`, `diff.patch`.
- **Imagens:** quadro infinito com o que os Vértices salvam em `.hypercube/saidas/`. HTML isolado, artboards lado a lado, comparar versões e comentar num ponto da imagem para mandar ao Vértice.
- **Roteador:** provedores gratuitos, chamadas do dia, cadeias editáveis por nível.
- **Sobre:** versão, licença e estrela.

Estados, sempre com forma e cor: ◐ trabalhando, ◆ esperando você, ● pronto, ✕ erro. Atalho `Alt+N` vai para quem espera há mais tempo; o título da janela mostra quantos esperam.

## Como está organizado

```
src/
  nativo/        acesso a terminais, arquivos e processos
    tipos.ts     o contrato
    simulado.ts  versão simulada (hoje)
    tauri.ts     chamadas para os comandos Rust do Tauri 2
    index.ts     escolhe a versão certa
  estado/        sessões, Vértices, avisos
  componentes/   barra lateral, barra de cima, terminal, Hiper, diálogos
  telas/         sessões, orquestração, imagens, roteador, sobre, primeira abertura
```

A interface só fala com o sistema por `src/nativo`. Dentro do Tauri 2 (`__TAURI_INTERNALS__` presente) ela usa `tauri.ts`; no navegador usa a versão simulada.

Abra com `?exemplo` para pular a primeira abertura (e `&tela=orquestracao`, `&sessao=Ideias`).

## Comandos

```
npm install
npm run build   # gera dist/
cargo build --release                  # compila o lançador
target/release/hypercube               # abre numa janela própria (Edge ou Chrome em modo app)
target/release/hypercube --exemplo     # abre direto com a sessão de exemplo
target/release/hypercube --screenshot tela.png   # salva a imagem da tela e sai
```

O lançador (`lancador/main.rs`, só a biblioteca padrão do Rust) existe até o app ir para o Tauri 2: serve `dist/` em 127.0.0.1 e abre a janela. Com `--screenshot` ele desenha sem janela, sem roubar o foco.

## Licença

MIT. O nome "Hypercube", o mascote Hiper e a logo não fazem parte da licença.
