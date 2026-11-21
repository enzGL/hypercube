# Briefing da rodada 0.2: perfil, agentes do seu jeito, temas

Pedido do Enzo (2026-11-20): na introdução a pessoa coloca o nome e uma foto e, se quiser, entra com o GitHub. Ela pode dar apelido e trocar a cor dos agentes, então essa parte precisa ser mais editável. Também entra uma parte de temas: os temas originais do TesserAct, com o atual (Noite) como padrão, um claro, um claro com cara de console, um escuro neutro e outros depois.

Três agentes trabalham em paralelo, cada um no seu worktree e na sua branch. O líder junta tudo no `main`.

| Agente | Worktree | Branch | Dono de |
|---|---|---|---|
| tema | `../hypercube-wt-tema` | `v/tema` | novo `estado/tema.ts`, `estilos.css`, `inicio.css`, `orquestracao.css` (só cores), cores fixas nos `.tsx`, novo `componentes/EscolherTema.tsx`, aba Aparência em `telas/Sobre.tsx` |
| perfil | `../hypercube-wt-perfil` | `v/perfil` | novo `estado/perfil.ts`, `telas/PrimeiraAbertura.tsx` (vira uma introdução em passos), cartão do usuário na `BarraLateral.tsx` (só o bloco `.usuario`), `BoasVindas.tsx` (nome e foto), novo `perfil.css` |
| agentes | `../hypercube-wt-agentes` | `v/agentes` | apelido e cor por agente: acréscimos no fim de `estado/loja.ts`, cabeçalho do terminal em `telas/Sessoes.tsx`, linha do agente na `BarraLateral.tsx` (só a função da linha), nós em `telas/Orquestracao.tsx` e em `PainelOrquestracao.tsx`, novo `componentes/EditarAgente.tsx`, novo `agentes.css` |

**Regra de conflito:** cada agente edita só os arquivos que são dele. Quem não for o agente tema não mexe em `estilos.css`: põe o CSS no seu arquivo novo e usa só tokens (`var(--…)`). Precisa de algo em `loja.ts`? Acrescente no fim do arquivo, sem mudar o que já existe. Nenhuma dependência npm nova sem contar no relatório.

## O que já existe
- App React + TS + Vite em `app/`, Tauri 2 em `app/src-tauri/`. Leia `docs/HANDOFF.md`, `docs/DECISOES.md` e `docs/VISAO.md`.
- No app, a palavra é **"agente"**, nunca "Vértice". Os papéis (líder, batedor, construtor, revisor) continuam.
- A primeira abertura e as boas-vindas são **cartões por cima do app** (o app aparece atrás), nunca página inteira nem modal que trava a tela.
- O app não pede estrela do GitHub; isso fica só no site.
- `nomeUsuario()` em `loja.ts` lê `localStorage['hypercube.nome']`, e o Início usa isso na saudação.
- Logos dos agentes: `componentes/LogoAgente.tsx`.

## Identidade
- Tema "Noite" (padrão): fundos `#080E22`, `#0B132D`, `#0E1738`, `#050916`; bordas `#1B2650` e `#27356B`; texto `#E8E9EB` e `#9AA3C7`; cobalto `#2238C4` e `#93A4FF`.
- Estados sempre com forma + cor: trabalhando ◐, esperando ◆, pronto ●, erro ✕. Em cada tema, a cor de estado precisa ter contraste suficiente com o fundo.
- Fontes: Geist, Geist Mono e Libre Baskerville. Mascote Hiper em `componentes/Hiper.tsx` (o SVG não muda; num tema claro, as cores dele podem vir de tokens).
- Temas do TesserAct para usar de base: `C:\Users\Enzo\Documents\Projects\tesseract\src\styles.css` (tokens `--t-*`, claro e `[data-theme='dark']`) e `src\app\theme.tsx`. Só leitura: não mexa nesse projeto.

## Como trabalhar
- `npm install` no worktree e `npm run build`, que precisa passar.
- Para conferir: `npm run dev -- --port <porta> --strictPort` e captura com o Chrome headless (`"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --screenshot=<arquivo> --window-size=1440,900 --virtual-time-budget=3000 "http://localhost:<porta>/?exemplo&semboasvindas&tela=inicio"`). Portas: tema 5191, perfil 5192, agentes 5193. Capturas em `C:\Users\Enzo\AppData\Local\Temp\hypercube-shots\`. Sem `?exemplo`, o app abre na primeira abertura.
- Nunca mexa no mouse nem no teclado do Enzo. Nada de app desktop: confira no navegador.
- **Cuidado com troca de texto por script:** confira que a troca entrou de fato (no Windows, fim de linha e acento já fizeram troca falhar sem aviso). Prefira a ferramenta Edit.
- Faça commits na sua branch, com a mensagem em pt-BR terminando em `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não faça push nem merge.
- Relatório final curto em pt-BR: o que fez, os arquivos tocados, o que testou e como, o que ficou pendente, os pedidos para o líder e o caminho das capturas.
