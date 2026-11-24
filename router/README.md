# Roteador de IA do Hypercube

Servidor local (Node, sem dependências) que recebe pedidos no formato da API da OpenAI e escolhe um modelo gratuito: Groq, OpenCode, Kiro e Gemini CLI. O nível "barato" dos agentes usa ele.

- Só escuta em `127.0.0.1`, pede token em toda chamada e recusa pedidos que vêm de páginas do navegador.
- O registro de uso guarda números, nunca o conteúdo.
- O Hypercube liga e desliga o roteador na tela **Roteador** (precisa do Node.js instalado) e gera o token sozinho.
- Config e registro ficam na pasta de dados do app (`ROUTER_DADOS`); `config.default.json` é o ponto de partida.
- Groq precisa de `GROQ_API_KEY` no ambiente; as CLIs (OpenCode, Kiro, Gemini) são achadas no PATH.

Rodar sozinho, para teste:

```bash
ROUTER_TOKEN=<24+ caracteres> ROUTER_PORT=18765 ROUTER_DADOS=./dados node server.js
```
