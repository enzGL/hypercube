# Hypercube: visão e estrutura

Criado em 2026-11-20. Pedido do Enzo: orquestrador de IA da TesserAct, grátis, código aberto, fácil, portátil, intuitivo e simples; focado em multissessão do Claude e canvas de orquestração; canvas de imagens ao vivo; mascote do chat (Hiper); roteador-ia dentro; download livre com pedido de estrela no GitHub.

## 1. Nome

**Hypercube**, o orquestrador de IA do TesserAct (comando no terminal: `hcube`).

- Tesseract = hipercubo de 4 dimensões. O nome fecha com o vocabulário que já existe: **Hiper** (mascote/assistente) e **Vértices** (agentes).
- Busca em 2026-11-20 não achou orquestrador de agentes com esse nome.
- Nome decidido pelo Enzo em 2026-11-20: só "Hypercube", sem "TesserAct" na frente; o TesserAct entra na frase de apresentação.

## 2. Para quem

1. Quem roda várias sessões do Claude Code (ou Codex, Gemini CLI, Kiro) em paralelo e se perde entre terminais.
2. Quem quer que um agente líder distribua tarefas para outros e acompanhar tudo num quadro.
3. Quem pede para a IA desenhar telas, imagens e canvas e quer ver o resultado ao vivo.

Promessa: **"Todos os seus agentes, num cubo só."** (eco de "Toda a sua operação, num núcleo só".)

## 3. Telas (o que a pessoa vê)

Base visual: barra lateral escura com sessões, área central, campo de comando embaixo, com o Hiper.

1. **Barra lateral:** Hiper no topo; projetos e sessões agrupados por pasta; contador de agentes por sessão; "+ nova sessão".
2. **Sessões (padrão):** grade de terminais reais (PTY), um por Vértice. Layouts automático, foco e grade livre. Fechar esconde, não mata o processo.
3. **Canvas de orquestração:** nós = Vértices (líder, batedor, construtor, revisor), ligações = quem passa trabalho para quem, condições (custo, cota, testes passaram). Cada nó mostra estado, custo, tokens e diff ao vivo.
4. **Canvas de imagens:** quadro infinito onde aparecem as imagens, telas HTML e artboards que os agentes geram. Também abre no navegador em `http://127.0.0.1:<porta>/canvas`.
5. **Estado vazio:** Hiper parado com "Nenhum Vértice nesta sessão" e botão para criar.
6. **Barra de cima:** contadores agentes, trabalhando, esperando, prontos; uso do plano (5 h, semana) do Claude e do Codex.

## 4. Mascote: Hiper

Usa o mascote já aprovado em 2026-11-16 (`design/mascote/hiper-escolhido.dc.html`): cubo isométrico arredondado em 3 tons (#7385F0, #2238C4, #1A2C9E), olhos ovais brancos, projeção hexagonal #8C9BF0.

Estados ligados às sessões:

| Estado do Hiper | Quando |
|---|---|
| repouso | nenhuma sessão trabalhando |
| processando (projeção acelera) | algum Vértice trabalhando |
| atenção | algum Vértice esperando a pessoa (permissão, pergunta) |
| sucesso (projeção abre) | tarefa concluída |
| erro (projeção apaga) | sessão caiu ou teste falhou |

Cada Vértice tem um mini-mascote no estilo dos bots do TesserAct (uma cor, olhos ovais brancos).
Abaixo de 32 px só o cubo; respeitar `prefers-reduced-motion`.

## 5. Features

Regra: todo o código é nosso; de fora, só bibliotecas instaladas por npm ou cargo. Detalhes em [DECISOES.md](DECISOES.md).

### Núcleo (versão 0.1)
- Terminais reais por agente, com histórico salvo e retomada depois de travar ou reiniciar.
- Agentes: Claude Code, Codex, Gemini CLI, Kiro, OpenCode e terminal comum.
- Estado de cada sessão por **hooks HTTP do Claude Code** para `127.0.0.1` com token (SessionStart, UserPromptSubmit, PreToolUse, Notification, Stop, SubagentStart/Stop).
- Subagentes aparecem embaixo do agente pai.
- Avisos: som, notificação do Windows, título da janela com contagem, atalho `Alt+N` para o agente que espera há mais tempo.
- Fechar ou atualizar o app não para os agentes.

### Orquestração (0.2)
- Agente líder distribui tarefas para Vértices em paralelo, cada um no seu **git worktree**.
- **Corrida** (`/race`): 2 a 4 agentes na mesma tarefa, escolher o melhor; **revisão cruzada**: um revisa o outro só lendo.
- **Roteiros (playbooks)** editáveis no canvas: papéis planejador, batedor, construtor, revisor, consertador; níveis barato, padrão, forte; limites de custo por rodada.
- Cada Vértice entrega `resultado.md`, `saida.json` e `diff.patch`; o líder lê só isso.
- **Servidor MCP local** do Hypercube: o líder cria, lê, manda mensagem e para Vértices (limite de 8 simultâneos e 3 níveis).

### Canvas de imagens (0.3)
- Pasta observada por sessão (`.hypercube/saidas/`): toda imagem, `.html` ou `.svg` que cair ali entra no canvas.
- Ferramentas MCP para o agente mandar direto: `canvas_adicionar_imagem`, `canvas_adicionar_html`, `canvas_artboard`.
- HTML abre em iframe isolado (sandbox, sem rede); artboards lado a lado com a "sugestão combinada", como nos nossos canvas.
- Comparar versões, comentar num ponto da imagem e mandar o comentário de volta ao agente.

### Roteador de IA (0.3)
- O **roteador-ia** (`C:\Users\Enzo\Documents\roteador-ia`, Node puro, `127.0.0.1:8765`, compatível com OpenAI) vira módulo do Hypercube.
- Vértices do nível "barato" (resumir, classificar, rascunho) vão para Groq, Gemini, Kiro grátis.
- Painel do roteador dentro do app: provedores, chamadas do dia, cadeias editáveis.
- Regras de segurança do roteador continuam: só localhost, token, recusa `Origin` de navegador, log sem conteúdo.

### Comunidade (última etapa)
Pedido do Enzo em 2026-11-20: um lugar onde quem usa o Hypercube mostra o que está construindo com ele.

- **Vitrine de projetos:** cada pessoa publica um projeto (nome, link, descrição curta, captura da página, estágio). Grade de cartões com busca por nome, pessoa ou tag; filtro por estágio (ideia, em construção, beta, no ar, faturando); ordem por estrelas, votos ou mais recentes. Quem visita dá estrela no que usaria.
- **Perfil:** nome, arroba com endereço próprio (`/gente/<arroba>`), "o que você constrói", cor e mascote. A pessoa escolhe entre os mini-mascotes de Vértice ou **cria o próprio** (cor, olhos, acessório), sempre no estilo do Hiper.
- **Selos por tempo de agente:** a pessoa ganha selos conforme as horas que teve Vértices trabalhando no Hypercube. Ranking semanal e mensal no site. Os desenhos dos selos ficam para o /design (série própria, ligada ao cubo: 1 vértice, aresta, face, cubo, hipercubo...).
- **Quem tem TesserAct:** entra com o login do TesserAct e ganha perfil mais personalizável (capa, mais cores, mascote animado, mais projetos fixados) e destaque na comunidade.
- **Privacidade:** a comunidade é opcional e desligada por padrão. O app só envia o total de horas de agente por dia, nunca conteúdo, nomes de pasta ou comandos. Sem a comunidade ligada, nada sai do computador (continua valendo "nada vai para a nuvem").
- **Contra trapaça no ranking:** contar só tempo com Vértice de fato trabalhando (estado "processando" pelos hooks), com teto por dia, e o servidor descarta saltos fora do normal.

Em aberto: onde roda o servidor da comunidade (pode ser o mesmo backend do TesserAct, já que o login é dele), nome e endereço da página, e a série de selos.

### Depois
- Celular: QR para acompanhar e responder agentes pelo telefone, com criptografia de ponta a ponta.
- Aba MCP e Skills: ver e copiar servidores MCP e skills entre agentes.
- Passar a conversa do Claude para o Codex e voltar.

## 6. Download e estrela

Decidido em 2026-11-20: **estrela pedida, não obrigatória**. O download é livre. O pedido aparece **só na página de download do site**; o app não pede estrela (decidido em 2026-11-20):

> É grátis para usar. Só pedimos que você dê uma estrela no GitHub!

Com um botão que abre `github.com/enzGL/hypercube` para dar a estrela. Sem login, sem checagem. Isso também evita conflito com a política do GitHub sobre estrelas incentivadas.

## 7. Como é feito (arquitetura)

- **App:** Tauri 2 (Rust) + React + TypeScript + Vite, o mesmo do TesserAct. Instalador pequeno e versão portátil (`.exe` único, sem instalar).
- **Terminais:** `portable-pty` no Rust + `xterm.js` na tela.
- **Canvas de orquestração:** React Flow (`@xyflow/react`, MIT).
- **Canvas de imagens:** quadro infinito próprio (pan, zoom, arrastar) sobre React.
- **Servidor local:** dentro do app Rust, só em `127.0.0.1`, porta aleatória, token por sessão; serve `/hook`, `/mcp` e `/canvas`.
- **Dados:** SQLite local (sessões, roteiros, custos). Nada vai para a nuvem.
- **Mascote:** componente React feito a partir de `hiper-escolhido.dc.html` (SVG + CSS, 5 estados). Mesmo componente que o TesserAct vai usar na etapa 1 do Hiper.

```
app/               Tauri: src-tauri (Rust: pty, hooks, mcp, canvas, sqlite) + src (React)
router/            roteador-ia em Node, compilado em executável único (sidecar do Tauri)
canvas/            página do canvas no navegador (mesma do app, servida em localhost)
site/              página de download (Cloudflare Pages, estática)
design/            protótipos e mascote
```

## 8. Roadmap

Ver [ROADMAP.md](ROADMAP.md).
