# Teste dos agentes na prática (rodada 1)

Branch `teste/agentes` (saiu de `skills/profundas` em `e1df2ad`, último commit de código `80def6c`).

## O que foi testado e o que mudou por causa disso

| Commit | O que o teste mostrou | Correção |
|---|---|---|
| `d4727dd` | Faltava um jeito de rodar o Líder de ponta a ponta dentro do app | Fumaça do Líder: com `HYPERCUBE_FUMACA` e `HYPERCUBE_FUMACA_LIDER_*` a interface abre uma sessão de equipe, aceita sozinha as permissões (só projeto de teste) e grava no log cada estado e cada resposta (`app/src-tauri/src/fumaca.rs`, `app/src/estado/fumacaLider.ts`). No uso normal não faz nada. |
| `e6e67a1` | Item sem regra de negócio ("desconto VIP") virava suposição inventada; revisão pulava a volta depois do Mecânico; agente com commit bloqueado travava a entrega | Papéis ajustados: item vago vira `pergunta` com opções, o Revisor volta depois do Mecânico, e quando o commit é bloqueado o agente entrega sem commit e o Líder commita (`app/src/papeis/lider.md`, `construtor.md`, `consertador.md`). |
| `6681e30` | O `esperar` do Líder caía em cerca de 1 minuto | Ajuste em `hooks.rs` e `terminais.rs`; o papel do Líder também diz para chamar `esperar` de novo se vier erro de tempo. |
| `80def6c` | O Codex não tinha fim de turno confiável e a resposta vinha suja | Fim do turno pela marca da tela e resposta limpa pelo registro da sessão (`terminais.rs`). |

## Resultados desta retomada (rodei nesta sessão)

- `cargo test` em `app/src-tauri` → 13 passaram, 0 falharam (compilação 5m16s).
  Cobrem hooks (token, Origin, terminal desconhecido, protocolo MCP, uso, ocioso), leitura do estado e da última resposta do Codex, UTF-8, pedido de confiar e criação de worktree.
- `npx tsc --noEmit` em `app` → sem erros (exit 0).

## Não rodei nesta retomada

- A fumaça do Líder de ponta a ponta com agentes reais (precisa do app aberto, de uma janela e de agentes reais gastando uso). Os resultados dela são os que motivaram os commits acima; não foram refeitos aqui.
- Teste prático do fim de turno do Codex e do `esperar` longo depois das correções, também por precisar do app e dos agentes reais.
- Build do app (`tauri build`).

## Falhas conhecidas

Nenhuma falha nos testes automáticos. Os itens da seção acima continuam sem prova nova.

## Junção em `skills/profundas`

Não foi feita (sem merge). Conferido com `git merge-tree --write-tree --name-only HEAD skills/profundas` → saída limpa, sem arquivos em conflito contra o que está commitado em `skills/profundas` (até `92749e6`).
Os conflitos esperados aparecem só quando `skills/profundas` receber os commits ainda não feitos (a branch tem mudanças sem commit em `app/src/estado/loja.ts`, `app/src/App.tsx` e outros, do menu do clique direito) e a mudança de `atualizar_lista`:

- `app/src/estado/loja.ts`: ficar com os dois lados; a fumaça só importa `criarSessao`, `criarVertice`, `lerEstado`, `mandar`, `nomeDoAgente` e `responder`, então basta manter essas exportações.
- `app/src-tauri/src/hooks.rs`: manter o ajuste do `esperar` desta branch junto com a ferramenta `atualizar_lista` da outra.
- `app/src/papeis/lider.md`: manter as duas frases novas desta branch (erro de tempo do `esperar`, item sem regra vira pergunta, commit bloqueado, volta do Revisor) junto com o texto da lista e do `atualizar_lista`.

Ordem sugerida: commitar o menu do clique direito em `skills/profundas`, depois juntar `teste/agentes` nela e rodar de novo `cargo test` e `npx tsc --noEmit`.
