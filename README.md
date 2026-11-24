# Hypercube

**Todos os seus agentes de IA, num cubo só.** Grátis e de código aberto.

🇧🇷 Português · [🇺🇸 English](README.en.md)

![Hypercube](site/img/logo.png)

O Hypercube é um app de desktop para quem trabalha com vários agentes de código ao mesmo tempo (Claude Code, Codex, Gemini, OpenCode...) e quer ver, dirigir e juntar o trabalho de todos num lugar só.

> Um tesseract é um hipercubo. Cada agente é um **agente**. O **Hiper** (o cubo mascote) rege todos.

**É grátis para usar. Só pedimos que você dê uma estrela no GitHub!** ⭐

## O que ele faz

- **Sessões**: todos os agentes numa janela, em terminais de verdade, cada um com o estado ao vivo (trabalhando, esperando você, pronto, erro) e aviso quando algo pede a sua resposta.
- **Orquestração**: um **Líder** divide a tarefa e cria agentes com papéis (Explorador, Construtor, Revisor, Mecânico). Cada Construtor trabalha numa cópia própria do projeto (worktree) e o resultado é revisado antes de juntar. Tudo aparece num canvas.
- **Canvas de imagens**: telas, imagens e desenhos que os agentes geram aparecem ao vivo, lado a lado, para você comparar versões. Os agentes usam as ferramentas `canvas_adicionar_*` (ou salvam em `.hypercube/saidas/`).
- **Roteador de IA**: um servidor local com modelos gratuitos (Groq, OpenCode, Kiro, Gemini) para as tarefas mecânicas. Os agentes ganham a ferramenta `consulta_barata` para resumir, classificar e extrair sem gastar o seu plano.
- **Seguro por padrão**: tudo roda na sua máquina, só em `127.0.0.1`, com token em cada chamada. O roteador nunca guarda o conteúdo das conversas.

## Baixar e usar

Baixe o instalador na [página de versões](https://github.com/enzGL/hypercube/releases/latest) (Windows primeiro; macOS e Linux depois). Você precisa ter pelo menos um agente instalado (por exemplo o Claude Code). O roteador precisa do [Node.js](https://nodejs.org).

## Rodar a partir do código

Precisa de Node 20+, Rust estável e o [Tauri 2](https://tauri.app/start/prerequisites/).

```bash
cd app
npm install
npm run tauri:dev      # app de desktop
npm run dev            # só a interface, com agentes simulados
```

## Pastas

| Pasta | O que vai ali |
|---|---|
| `app/` | App desktop (Tauri 2 + React + TypeScript) |
| `router/` | Roteador de IA (Node, sem dependências) |
| `docs/` | Visão, roadmap, decisões |
| `design/` | Logo e o mascote Hiper |
| `site/` | Página de download |

Comece por [`docs/VISAO.md`](docs/VISAO.md) e acompanhe o [`docs/ROADMAP.md`](docs/ROADMAP.md).

App separado do [TesserAct](https://github.com/enzGL/tesseract) (o app de gestão). Não tem plano pago.

## Licença

[MIT](LICENSE). O nome "Hypercube", o mascote Hiper e a logo não fazem parte da licença.
