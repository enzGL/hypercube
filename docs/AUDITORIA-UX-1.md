# Auditoria de UX 1 (2026-11-20)

Feita com os outros modelos do computador, cada um numa cópia do `main` (c6e8c1a), só para leitura:
- **Codex** (`gpt-6-luna`, sandbox read-only): 17 achados.
- **Gemini** (modo plan, só leitura): 15 achados.
- **Kiro:** não rodou, porque o limite do mês acabou.
- **OpenCode:** não rodou, porque a instalação está quebrada.

O líder conferiu cada achado no código. Abaixo estão só os que se confirmaram, já juntando os repetidos. A coluna "Fonte" diz quem apontou: C = Codex, G = Gemini.

## Alta
| # | Tela | Problema | Sugestão | Fonte | Evidência |
|---|---|---|---|---|---|
| 1 | Primeiro uso | A introdução é seguida pelo cartão "Olá" do dia, e "Começar" só fecha esse cartão | No primeiro dia não mostrar o "Olá"; "Começar" leva a um primeiro passo guiado (mandar uma tarefa de exemplo) | C | `BoasVindas.tsx`, `App.tsx` |
| 2 | Início | O modo Equipe cria um Gemini e um Codex fixos mesmo quando eles não estão instalados | Montar a equipe só com os agentes encontrados e avisar o que falta | C | `Inicio.tsx:219-220` |
| 3 | Início / Novo agente | Normal, Planejar e Equipe e Barato, Padrão e Forte aparecem sem explicação | Uma frase em cada opção ("Equipe: cria 4 agentes com papéis") | C, G | `Inicio.tsx:22`, `Dialogos.tsx` |
| 4 | Sessões | `/corrida` e `/revisar` só aparecem no texto cinza do campo | Menu de comandos ao digitar `/`, ou botões | G | `Sessoes.tsx` (campo de tarefa) |
| 5 | Sessões | Terminais, campo, painel de orquestração, painel direito e avisos disputam espaço; os avisos cobrem a faixa de permissão | Avisos que não ficam por cima de pedido pendente; orquestração começa recolhida quando só há 1 agente | C | captura `main-sessoes`, `estilos.css` (`.avisos`) |

## Média
| # | Tela | Problema | Sugestão | Fonte | Evidência |
|---|---|---|---|---|---|
| 6 | Orquestração | "workers" e "planner" em inglês na tela ("1 de 3 workers", "Escolha um worker", "Novo planner") | "agentes" e "líder" | C, G | `PainelOrquestracao.tsx:126-160` |
| 7 | Sessões / Nova sessão | "worktree" sem explicação | "cópia separada do projeto para cada agente" com dica | C | `Sessoes.tsx:93`, `Dialogos.tsx:82` |
| 8 | Sessões | Os papéis só são explicados no diálogo de criação | Descrição curta visível na lateral e no cabeçalho | C | `loja.ts` (`NOME_PAPEL`) |
| 9 | Painel direito | "Tarefas" (lista pessoal) se confunde com as tarefas dos agentes | "Minhas tarefas"; Pomodoro recolhível | C | `PainelDireito.tsx` |
| 10 | Permissão | Permitir e Negar não dizem o que autorizam | Mostrar a ação pedida em linguagem direta | C | `Sessoes.tsx` (faixa de permissão) |
| 11 | Primeira abertura | Espera fixa de 0,7 s antes de procurar agentes, sem caso de erro nem "tentar de novo" | Procurar na hora, com progresso e "tentar de novo" | C, G | `PrimeiraAbertura.tsx:40` |

## Baixa
| # | Tela | Problema | Sugestão | Fonte |
|---|---|---|---|---|
| 12 | Diálogos | Nenhum diálogo tem `aria-modal` nem foco preso | Marcar como modal e prender o foco | C |
| 13 | Lateral recolhida | Só ícones | Dica com o nome ao passar o mouse e no foco | C, G |
| 14 | Encerrar | Já pede confirmação, mas fica colado no Ocultar | Separar ou levar para um menu | G |
| 15 | Imagens | Modo comentar sem cursor próprio; comparar só sobrepondo (não conferido) | Cursor de balão; opção lado a lado | G |

## Descartados na conferência
- Contraste do texto secundário (`#9AA3C7` sobre `#0E1738`): dá cerca de 6,9:1, então passa no nível AA.
- Saudação pelo relógio local ser um problema: é o esperado.
- "Encerrar sem confirmação": a confirmação já existe.
- Digitar "sim" no campo geral para responder permissão: é especulação, sem caso real.

## Situação (2026-11-21)
- Feitos em 2026-11-20: #1, #2, #3 (modos), #6.
- Feitos em 2026-11-21: #3 (níveis com frase no diálogo), #4 (menu ao digitar `/`, com setas, Tab e Esc), #5 (em Sessões os avisos ficam numa faixa acima do campo; orquestração começa recolhida com 1 agente), #7 (worktree explicado), #9 ("Minhas tarefas"; Pomodoro recolhível), #10 (pedido em linguagem direta, com dica em cada botão), #11 (procura na hora, com "tentar de novo" e aviso quando não há agente). Novo agente também cai num agente instalado quando o sugerido não está.
- Faltam: #8, #12 a #15.
