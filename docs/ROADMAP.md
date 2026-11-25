# Roadmap

Uma etapa por vez, cada uma testada no app antes da próxima.

| Etapa | O que entrega | Pronto quando |
|---|---|---|
| 0. Design | /design: primeiro a logo em dither (3 ideias), depois canvas com 3 direções + sugestão combinada para barra lateral, sessões, canvas de orquestração, canvas de imagens e estado vazio com o Hiper | Enzo aprova uma direção |
| 0.1 Núcleo | Tauri + React; terminais reais; Claude Code e Codex; hooks com estado ao vivo; Hiper com 5 estados; avisos; versão portátil | 3 sessões do Claude rodando e o Hiper reagindo |
| 0.2 Orquestração | Worktrees; líder + Vértices; corrida e revisão cruzada; canvas de orquestração com roteiros; servidor MCP | líder divide uma tarefa em 3 Vértices e junta o resultado |
| 0.3 Imagens e roteador | Canvas de imagens (app + localhost); ferramentas MCP de canvas; roteador-ia dentro | agente gera 3 telas e elas aparecem no canvas ao vivo |

_0.3 em 2026-11-23/24: canvas ao vivo pela pasta `.hypercube/saidas/`, roteador dentro (`router/`, ligado pela tela Roteador), ferramentas MCP `canvas_adicionar_imagem/html/svg` para todo agente (Claude e Codex) e `consulta_barata` (texto simples pelo roteador, para resumir/classificar sem gastar o plano). Decisão: agente que usa ferramentas não roda direto num modelo gratuito (as CLIs gratuitas só devolvem texto), então o roteador entra como ferramenta, não como motor do agente._

_0.4 em 2026-11-24: README PT/EN e página `site/` prontos; instalador gerado e release v0.1.0 publicada no GitHub. Em 2026-11-25: v0.1.1 com terminal como padrão e apagar sessão/projeto._
| 0.4 Lançamento | README em PT/EN, página de download com pedido de estrela | instalador baixado pelo site |
| Feito (2026-11-25, conferido no app real): terminal como padrão | Agentes viram parte bem opcional e o normal é o terminal puro, como num workspace de terminais. Nova sessão começa com **Terminal** (shell comum), não com agente; botão principal do cabeçalho vira "+ Terminal" e "Agente" fica secundário; a linha "Com agentes" da lateral, a aba Orquestração e o campo de comando "Para…" só aparecem em sessão com agentes ligados; estado vazio fala de terminal | abrir o app, criar sessão e usar um terminal sem ver nada de agente |
| Depois | Celular via QR; aba MCP/Skills; passar conversa entre agentes | — |
| Última: Comunidade | Vitrine de projetos com estrelas; perfil com cor e mascote próprio; selos por horas de agente com ranking semanal e mensal; login do TesserAct com perfil mais personalizável e destaque; envio opcional só do total de horas | uma pessoa publica um projeto, ganha o primeiro selo e aparece no ranking da semana |
| Comunidade: loja de agentes (nome a definir, ex.: CuboAgents) | Agentes do cubo (skill + mascote) para baixar no orquestrador; qualquer um cria e publica, a equipe aprova antes de ir ao ar; documento de como escrever a skill; modelos de mascote para escolher cor, acessório, nome e descrição curta | uma pessoa cria um agente, ele é aprovado e outra pessoa baixa e usa no Hypercube dela |
