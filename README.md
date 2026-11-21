# Hypercube

O orquestrador de IA do TesserAct. Grátis e de código aberto.

> Um tesseract é um hipercubo. Cada agente é um **agente**. O **Hiper** (o cubo mascote) rege todos.

Para quem trabalha com várias sessões do Claude Code (e Codex, Gemini, Kiro...) ao mesmo tempo e quer:

- ver todas as sessões numa janela, com o estado de cada uma (trabalhando, esperando você, pronto, erro);
- montar a orquestração num **canvas** (quem planeja, quem executa, quem revisa);
- ver num **canvas de imagens** tudo o que os agentes geram (imagens, telas HTML, artboards);
- gastar menos usando o **roteador-ia** (modelos gratuitos) nas tarefas mecânicas.

App separado do [TesserAct](https://github.com/enzGL/tesseract) (o app de gestão). Não tem plano pago.

**É grátis para usar. Só pedimos que você dê uma estrela no GitHub!** ⭐

## Pastas

| Pasta | O que vai ali |
|---|---|
| `docs/` | Visão, arquitetura, roadmap, decisões |
| `design/` | Protótipos (/design) e o mascote Hiper aprovado |
| `app/` | App desktop (Tauri 2 + React + TypeScript) |
| `router/` | Integração com o roteador-ia (modelos gratuitos) |
| `canvas/` | Servidor local do canvas de imagens + servidor MCP |
| `site/` | Página de download |

Comece por [`docs/VISAO.md`](docs/VISAO.md).

## Licença

[MIT](LICENSE). O nome "Hypercube", o mascote Hiper e a logo não fazem parte da licença.
