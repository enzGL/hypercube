# Decisões

## Tomadas (2026-11-20)
- **App separado** do TesserAct, pasta própria `Documents/Projects/hypercube`. Grátis, sem plano Pro.
- **Nome:** Hypercube, "o orquestrador de IA do TesserAct". Mascote: Hiper (aprovado em 2026-11-16). Agentes: Vértices.
- **Stack:** Tauri 2 + React + TypeScript, igual ao TesserAct.
- **Código só nosso ou MIT/Apache.** De projetos com licença incompatível com MIT (AGPL, GPL e afins) ou com marca não licenciada, nada de código, CSS, ícones, imagens, textos ou nomes. O app e o repositório não citam esses projetos.
- **Nenhuma referência a outros apps** (2026-11-20, regra crítica do Enzo): código, docs, telas, textos e commits não citam nem copiam outros apps. Também não reaproveitamos código de outros apps, nem MIT, porque o MIT obriga a manter o aviso com o nome. Só bibliotecas instaladas por gerenciador de pacotes (npm, cargo), com as licenças delas no pacote final.
- Canvas de orquestração com React Flow (biblioteca MIT).

- **Licença: MIT** (2026-11-20). Diferente do TesserAct (PolyForm Noncommercial): aqui qualquer um usa, muda e distribui. O nome "Hypercube", o Hiper e a logo não entram na licença. Por ser MIT, nada de código com licença AGPL ou GPL.
- **Estrela pedida, não obrigatória** (2026-11-20). Download livre; a página mostra "É grátis para usar. Só pedimos que você dê uma estrela no GitHub!" com o botão da estrela ao lado do link. Sem login do GitHub, sem trava. O app em si não pede estrela.
- **Repositório próprio e público:** `enzGL/hypercube`, com link para o TesserAct no README.
- **Roteador-ia em Node na 0.3** (2026-11-20, escolha do Claude): reaproveita o roteador que já funciona, compilado num executável único (Node SEA) e rodado pelo Tauri como sidecar, então a versão portátil continua sendo uma pasta só. Portar para Rust só se o tamanho ou a partida pesarem.
- **Logo: ideia C, "Oito Vértices"** (2026-11-20): cubo de 8 cubos menores em dither cobalto, o da frente flutua (o líder). O Hiper (ideia B, mascote em dither) segue como personagem dentro do app. Protótipo em `design/logo/logo-ideias.html`.
- **Telas: direção "sugestão" aprovada** (2026-11-20): base Noite (escuro, cobalto) + títulos em Libre Baskerville do Toile + logo e estados da Grade. Quatro telas desenhadas: Sessões, Orquestração, Imagens e Primeira abertura com o Hiper (o mesmo de `design/mascote/hiper-escolhido.dc.html`). Canvas: https://claude.ai/artifact/APYzKCmu9hscumPSpHyoGA

## Fontes
- https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
