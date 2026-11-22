# Auditoria de UX 2 (2026-11-22)

Feita na branch `skills/profundas` (com as ferramentas do Líder, as sessões que voltam e os papéis novos), percorrendo o app como uma pessoa nova.

**Como foi testado.** A interface rodou pelo Vite, no modo simulado (os agentes são de mentira), num navegador sem janela controlado por script, nos tamanhos 1440×900 e 1366×768. Caminho seguido: introdução inteira, exemplo, Sessões, fechar e abrir o app (sessões que voltam), "Abrir de novo" e "Abrir todos de novo", agentes criados pelo Líder (ligação forçada no estado guardado), Novo agente, Apelido e cor, Início nos modos Planejar e Equipe, envio no modo Equipe e a tela de Orquestração.

**O que não foi testado:** a janela do app nativo (Tauri) e um Líder de verdade chamando agentes pelas ferramentas. Isso gastaria a cota dos agentes, e quem testa os agentes é outra frente de trabalho.

## Corrigido nesta rodada

| # | Gravidade | Tela | O que acontecia | O que foi feito | Commit |
|---|---|---|---|---|---|
| 1 | Alta | Sessões | Com o nome longo da sessão (o modo Equipe usa a própria tarefa como nome), o título passava por cima dos contadores | O título é cortado com "…" e mostra o nome inteiro ao passar o mouse; os contadores não encolhem | `eed48ea` |
| 2 | Alta | Sessões | Em tela de até 860 px de altura, o painel de orquestração (360 px fixos) deixava cada terminal com 2 linhas | A altura passa a acompanhar a tela (de 220 a 360 px), e o painel começa recolhido abaixo de 860 px se a pessoa ainda não escolheu | `b696441` |
| 3 | Média | Sessões e lateral | Agente fechado junto com o app aparecia como "● Pronto" (verde) no painel, na lateral e no contador de prontos | Aparece "○ Fechado" em cinza e não conta como pronto | `eed48ea` |
| 4 | Média | Sessões | Agente já fechado ainda mostrava o X "Encerrar o processo", que não fazia nada útil | O X some quando o agente está fechado | `eed48ea` |
| 5 | Média | Lateral | Os agentes criados pelo Líder ficavam soltos, sem ligação visível com ele | Eles aparecem dentro do Líder na lateral (soltos de novo durante a busca). O painel mostra "de Líder". O contador da sessão conta todos | `eed48ea` |
| 6 | Média | Lateral (Hiper) | "Algo deu errado." sem dizer o que nem onde | "Terminal parou com erro." / "Revisor precisa de você.", com o nome de quem | `b696441` |
| 7 | Média | Novo agente | A descrição do Líder prometia "entrega o pull request", mas ele só abre o PR quando a pessoa pede | "Divide o pedido em itens, chama a equipe e prepara o pull request" | `eed48ea` |
| 8 | Média | Orquestração (barra recolhida) | O número do limite de agentes sumia: as setinhas do campo ocupavam o espaço todo em 1366 px | Campo sem setinhas e sem encolher | `b696441` |
| 9 | Baixa | Sessões | Faixa do agente fechado em 3 linhas ("Este agente fechou junto com o app. Abrir de novo começa uma conversa nova, sem tarefa.") | "Fechou junto com o app. Abre de novo sem tarefa, esperando você." | `eed48ea` |
| 10 | Baixa | Introdução, passo 2 | "Ela aparece na lateral." sem dizer o que é "ela" | "Quer pôr uma foto? Ela aparece na lateral. Dá para pular." | `5552ff0` |
| 11 | Baixa | Introdução, passo 5 | Título "Seus agentes" com "Estas eu achei", "Instaladas" e "Nenhuma IA" | Tudo no masculino ("Estes", "Instalados", "Nenhum agente encontrado") | `5552ff0` |
| 12 | Baixa | Avisos | Botão "Ver" com 21×20 px | Alvo de 32 px de altura | `b696441` |
| 13 | Baixa | Cabeçalho | "1 agentes" | "1 agente" | `b696441` |

Prova: `npx tsc --noEmit` sem erros e `npm run build` ok. As capturas estão antes e depois de cada correção, na pasta de capturas da revisão (ver a entrega).

## Para decisão do Enzo (não implementado)

| # | Gravidade | Tela | O que acontece | Proposta |
|---|---|---|---|---|
| A | Alta | Sessões / Minhas tarefas | A lista de trabalho do Líder (itens aberto, em andamento, fechado, pergunta) só existe no texto do terminal dele. A pessoa não vê a lista como lista, e as perguntas no item se perdem no meio da saída | Mostrar a lista do Líder no painel direito, ao lado de "Minhas tarefas", com o estado de cada item e "Responder" no item que tem pergunta. Pede uma ferramenta nova do Líder (ex.: `atualizar_lista`) ou a leitura das linhas `N. [estado]` da entrega |
| B | Alta | Início, modo Equipe | Depois de enviar, aparece só o Líder, e os outros agentes só surgem quando ele chama. A pessoa pode achar que a equipe não foi criada | Uma faixa no painel do Líder: "O Líder vai chamar a equipe. Os agentes aparecem aqui quando ele criar." |
| C | Média | Sessões | Há dois campos para mandar tarefa (o "Para … Mandar" e o "Escolha um agente… / Dar mais trabalho a ele" do painel de orquestração), com o mesmo efeito | Deixar só um, ou fazer o da orquestração abrir o campo principal já com o agente escolhido |
| D | Média | Sessões | Não existe "remover da sessão" para agente fechado: ele só pode ser aberto de novo ou ocultado | Botão "Tirar da sessão" no agente fechado (apaga só o cartão, não a branch nem a cópia) |
| E | Média | Sessões | Avisos de "terminou" se acumulam em linha acima do campo e tomam até 3 linhas da tela | Juntar os avisos de "terminou" num só ("3 agentes terminaram") ou fechá-los sozinhos depois de alguns segundos |
| F | Baixa | Sessões | Em 1366 px o nome da sessão fica em "Check…" porque os botões de layout ocupam o espaço | Passar os layouts (Automático, Foco, Grade livre) para um menu só, ou o nome para uma segunda linha |
| G | Baixa | Introdução | O passo 3 (GitHub) repete o botão "Usar a do GitHub" do passo 2 | Juntar os dois passos (4 passos em vez de 5) |
| H | Baixa | Apelido e cor / Novo agente | As cores têm 20×20 px e os níveis (Barato, Padrão, Forte) têm 26 px de altura | Subir para 28 a 32 px |

## Fora do escopo desta revisão
- Quando o Vite serve o app, as fontes vêm da `node_modules` do repositório principal e o servidor recusa com 403, então o modo de desenvolvimento usa a fonte de reserva. O app empacotado não tem o problema.
