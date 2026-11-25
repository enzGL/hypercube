<div align="center">

<img src="site/img/logo.png" alt="Hypercube" width="120" />

# Hypercube

**All your AI agents, in one cube.**

[🇧🇷 Português](README.md) · 🇺🇸 English

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/enzGL/hypercube?include_prereleases)](https://github.com/enzGL/hypercube/releases/latest)
[![Stars](https://img.shields.io/github/stars/enzGL/hypercube?style=flat)](https://github.com/enzGL/hypercube/stargazers)
[![Open issues](https://img.shields.io/github/issues/enzGL/hypercube)](https://github.com/enzGL/hypercube/issues)

[Download](https://github.com/enzGL/hypercube/releases/latest) · [Report a bug](https://github.com/enzGL/hypercube/issues/new) · [Request a feature](https://github.com/enzGL/hypercube/issues/new) · [Contribute](#contributing)

</div>

> **Heads up:** Hypercube is early (0.x). The interface is Portuguese-only and the installer is Windows-only for now. It is _local-first_: everything runs on your machine, and nothing leaves it unless you turn it on.

**It's free to use. We only ask that you star the repo on GitHub!** ⭐

## What Hypercube is

Hypercube is a desktop app for people who run several coding agents at once and want to watch, direct and combine all of their work in one place. Instead of ten loose terminal windows, you get one window with every agent, each one's live state, and a notification when one needs your answer.

> A tesseract is a hypercube. Each agent is a **Vertex**. **Hiper** (the cube mascot) rules them all.

## Platforms

| Platform | Status |
|---|---|
| Windows | Installer and portable build |
| macOS | Later |
| Linux | Later |

## Agents

Hypercube opens the agents you already have installed, in real terminals. You install and sign in to each one the usual way.

| Agent | Live state | Notes |
|---|---|---|
| Claude Code | Yes, via hooks | Main one; understands the orchestrator |
| Codex | Yes | Gets the same canvas tools |
| Gemini CLI | Terminal | |
| Kiro | Terminal | |
| OpenCode | Terminal | |
| Plain terminal | Terminal | For anything else |

## What it does

### Run agents in parallel

Every agent in one window, each with a live state: working, waiting for you, done or error. Closing the window doesn't kill the process, and history is saved so you can pick it up later.

### Orchestrate

A **Leader** splits the task and creates agents with roles: **Scout**, **Builder**, **Reviewer** and **Fixer**. Each Builder works in its own copy of the project (a git worktree), and the result is reviewed before merging. It all shows up on an orchestration canvas.

### See what agents create

Screens, images and drawings the agents produce appear live on the image canvas, side by side, so you can compare versions. Agents use the `canvas_adicionar_imagem`, `canvas_adicionar_html` and `canvas_adicionar_svg` tools (or save to `.hypercube/saidas/`).

### Spend less of your plan

The **AI router** is a local server with free models (Groq, OpenCode, Kiro, Gemini) for mechanical tasks. Agents get a `consulta_barata` tool to summarize, classify and extract without spending your plan.

### Stay in control

- Everything runs on `127.0.0.1` only, with a token on every call.
- The router never stores conversation content.
- No account, no telemetry, no paid plan.

## Core concepts

| Term | What it is |
|---|---|
| Session | A set of agents working on the same project |
| Project | A folder on your computer |
| Vertex | An agent running in a real terminal |
| Leader | The Vertex that splits the task and creates the others |
| Role | Scout, Builder, Reviewer or Fixer |
| Hiper | The cube mascot; changes with the state of the sessions |

## Philosophy

- **Free and open.** No paid plan, no login.
- **Simple first.** One thing at a time, each tested in the app before the next.
- **Your computer is in charge.** Nothing goes to the cloud; the only way out is the one you turn on.
- **Our own code.** Only libraries installed through npm or cargo come from outside.

## Install

Get the installer from the [releases page](https://github.com/enzGL/hypercube/releases/latest) (Windows first). You need at least one agent installed (for example Claude Code). The router needs [Node.js](https://nodejs.org).

> The Windows installer is not code-signed yet, so SmartScreen may warn you the first time. Click "More info" and then "Run anyway".

## Run from source

Needs Node 20+, stable Rust and [Tauri 2](https://tauri.app/start/prerequisites/).

```bash
cd app
npm install
npm run tauri:dev      # desktop app
npm run dev            # UI only, with simulated agents
npm run tauri:build    # build the installer
```

| Folder | What lives there |
|---|---|
| `app/` | Desktop app (Tauri 2 + React + TypeScript) |
| `router/` | AI router (Node, no dependencies) |
| `canvas/` | Browser canvas page |
| `docs/` | Vision, roadmap, decisions |
| `design/` | Logo and the Hiper mascot |
| `site/` | Download page |

## Roadmap

- [x] **0.1 Core**: real terminals, Claude Code and Codex, live state, notifications
- [x] **0.2 Orchestration**: worktrees, Leader and Vertices, orchestration canvas
- [x] **0.3 Images and router**: live image canvas, MCP tools, router built in
- [ ] **0.4 Launch**: PT/EN README, download page, published installer
- [ ] Phone via QR, MCP and Skills tab, hand a conversation between agents
- [ ] Community: project showcase, profiles, badges and an agent store

Details in [`docs/ROADMAP.md`](docs/ROADMAP.md). To understand the idea, start with [`docs/VISAO.md`](docs/VISAO.md) (both in Portuguese).

## Contributing

Contributions are welcome. Open an [issue](https://github.com/enzGL/hypercube/issues) to talk before big changes, and read [`docs/DECISOES.md`](docs/DECISOES.md) to see what has already been decided. One pull request per topic, tested in the app.

## License

[MIT](LICENSE). The "Hypercube" name, the Hiper mascot and the logo are not part of the license.

## Community

- [Issues](https://github.com/enzGL/hypercube/issues): questions, problems and ideas
- [Stars](https://github.com/enzGL/hypercube/stargazers): the easiest way to help
- Maintained by [Enzo (enzGL)](https://github.com/enzGL), at [Lanzi Labs](https://lanzilabs.dev)
- A separate app from [TesserAct](https://github.com/enzGL/tesseract) (the management app)
