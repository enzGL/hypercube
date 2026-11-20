# Briefing da rodada 0.1: casca nova + Tauri real

Esta rodada tem 4 Vértices trabalhando em paralelo, cada um no seu worktree e branch. O líder (sessão principal) junta tudo no `main`.

| Vértice | Worktree | Branch | Dono de |
|---|---|---|---|
| casca | `../hypercube-wt-casca` | `v/casca` | `App.tsx`, `BarraTopo.tsx`, `BarraLateral.tsx`, novo `PainelDireito.tsx`, `estilos.css` (só seções da casca) |
| inicio | `../hypercube-wt-inicio` | `v/inicio` | novo `telas/Inicio.tsx`, novo `componentes/BoasVindas.tsx`, novo `componentes/FundoDither.tsx`, `inicio.css` |
| orquestracao | `../hypercube-wt-orquestracao` | `v/orquestracao` | novo `componentes/PainelOrquestracao.tsx`, novo `componentes/HiperMini.tsx`, `orquestracao.css` |
| tauri | `../hypercube-wt-tauri` | `v/tauri` | `app/src-tauri/` (novo), `nativo/tauri.ts`, `nativo/index.ts`, `package.json`, `vite.config.ts` |

**Regra de conflito:** só edite os arquivos que são seus. Precisa de algo novo em `loja.ts` ou em `tipos.ts`? Adicione no fim do arquivo, sem mudar o que já existe, e conte isso no relatório. Precisa de uma dependência npm? Só o Vértice tauri mexe em `package.json`. Os outros anotam o pedido no relatório.

## Referência de estrutura (prints do app de referência)
Pasta: `C:\Users\Enzo\Documents\Craft Anything\alethe\capture\ref\`. As mais úteis: `alethe-direto.png`, `alethe-pw3.png`, `monitor2.png`, `boas-vindas.png`, `principal.png`, `sessoes.png`. Muitas mostram também o terminal de outro agente por cima; ignore esse conteúdo. **Não abra `tela-atual.png`**: é uma conversa pessoal.

Copie a organização e o comportamento, nunca o visual, os textos de marca, o logo, os ícones ou o nome. Nada no repositório cita o app de referência: nem no código, nem nos comentários, nem nos nomes de arquivo, nem nos commits.

O que as prints mostram:
1. **Barra de cima:** botão de menu, botão de recolher a lateral, voltar e avançar, **abas de projeto** (avatar, nome, "+ N" e um contador de terminais; a aba ativa tem um ×). À direita ficam: notas, sincronizar, perfil ("Default"), **chips de uso por agente** (Claude 99%, Codex 0%, Gemini 21%, com cor de alerta quando está alto), memória RAM do app ("3557 MB") e o botão do painel direito.
2. **Lateral esquerda:** faixa de ícones no topo (Início, Sessões/grade, Arquivos, Git), busca, título "PROJETOS" com os botões nova pasta e +, uma árvore de projetos (avatar e nome) e, dentro de cada um, terminais com o ícone do agente e um "✓" verde quando pronto ou um spinner quando trabalhando, além das entradas "Orquestração". No rodapé: "WORKSPACE · desenhar grid" e o cartão do usuário (avatar, nome, "conta local · Default", engrenagem).
3. **Centro:** painel de terminal com cabeçalho (ícone do agente, nome) e uma barra de ícones (silenciar, dividir, histórico, trocar, abrir no editor, expandir, reiniciar, lixeira). Embaixo vem a linha de status do agente (perfil · modo · contexto % · pasta · branch). Vários projetos podem ficar lado a lado em colunas, cada uma com o seu cabeçalho.
4. **Painel de orquestração preso embaixo do terminal:** título "Orquestração"; aviso de uso ("claude em 99% (reseta 3h45m)"); "0 rodando · 0 na fila · limite 4"; uma aba por planner com um +. À esquerda fica o canvas ("Este planner ainda não delegou nenhum trabalho", "Arraste o canvas para mover · Ctrl + scroll para dar zoom", controles de zoom − ajustar 100% +). À direita fica o **resumo**: "0 de 0 workers 0%", contadores esperando você / rodando / na fila / interrompidos / falhou / encerrados / vagas em uso 0/4, e a seção EXECUÇÕES. Embaixo: "Escolha um worker para…" e o campo "Dar mais trabalho a ele…".
5. **Painel direito:** abas de ícone (Notas, Tarefas, Plugins, Git) e o painel Tarefas com a barra de progresso 0/0, os filtros Tudo / Ativas / Concluídas, "Adicionar uma tarefa… Ctrl+N", **Pomodoro** ("Pronto pra focar 0:00", Iniciar, "Foco em: nenhuma tarefa selecionada") e o estado vazio "Nada na sua lista".
6. **Início:** saudação grande ("Boa tarde, enzo."), data e hora, e uma **caixa de comando** em forma de janela de terminal ("O que você quer construir?", com os seletores Agente, Pasta e Modo e o botão enviar). Atalhos "novo terminal" e "novo projeto". Depois: PROJETOS RECENTES (cartões com avatar, N terminais e quando), COMECE ALGO (novo terminal Ctrl+T, novo projeto Ctrl+Shift+P, novo grupo Ctrl+Shift+G) e USO & ATIVIDADE (cartões por agente com plano, "ao vivo", % e tempo até resetar; o cartão de atividade de 90 dias mostra o total de mensagens e a variação). O fundo traz uma ilustração grande em dither ASCII, à direita e por trás.
7. **Modal de boas-vindas** quando o app abre: avatar, "DIA N NO <APP>", "Olá, <nome>", "Bem-vindo de volta. Vamos orquestrar seus terminais de hoje?", botões Pular e Começar.
8. **Animação de agente trabalhando:** um spinner pixelado verde na lateral. O Enzo pediu: "reimaginar e colocar no hyper". Fica com o Vértice orquestracao, como `HiperMini`.

## A nossa identidade (manda sobre tudo)
- Direção "Noite": fundos `#080E22` (lateral), `#0B132D` (principal), `#0E1738` (cartões), `#050916` (terminal). Bordas `#1B2650` e `#27356B`. Texto `#E8E9EB`, secundário `#9AA3C7`. Cobalto `#2238C4` nos botões e `#93A4FF` em links e foco. Use os tokens que já existem em `app/src/estilos.css`; nunca escreva um hex solto se o token existir.
- Estados sempre com forma + cor: trabalhando `#93A4FF` ◐, esperando você `#E9A21B` ◆, pronto `#4CC38A` ●, erro `#F0646E` ✕.
- Fontes: Geist (texto), Geist Mono (terminal e números), Libre Baskerville (títulos e saudação).
- Logo pixel art `app/public/logo-hypercube.png` (`image-rendering: pixelated`). Mascote Hiper em `componentes/Hiper.tsx`: o SVG não muda.
- Agentes = **Vértices** (líder, batedor, construtor, revisor). Os textos são em pt-BR e simples, sem jargão.
- O dither do Início é do Hiper/cubo (ou do hipercubo em projeção), em cobalto, e **nunca** uma foto. Pontilhado fraco, o suficiente para não brigar com o texto.
- Modal de boas-vindas: o Hiper no lugar do avatar, "DIA N NO HYPERCUBE".

## Como trabalhar
- Rode `npm install` (com node_modules no worktree) e `npm run build` antes de terminar; o build precisa passar.
- Para conferir o visual: `npm run dev` e uma captura em 1440×900 pelo Chrome headless (`chrome --headless=new --screenshot=... --window-size=1440,900 http://localhost:<porta>`). Use uma porta própria: casca 5181, inicio 5182, orquestracao 5183, tauri 5184. Não mexa no mouse nem no teclado do Enzo.
- Faça commits na sua branch, com a mensagem em pt-BR terminando em `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não faça push nem merge.
- O relatório final, curto, traz: o que fez, os arquivos tocados, o que ficou pendente, os pedidos para outros Vértices e o caminho das capturas.
