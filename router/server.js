'use strict';
// Roteador local de modelos de IA (sem dependências). Escuta só em 127.0.0.1.
// Formato OpenAI: POST /v1/chat/completions, GET /v1/models, GET /saude.
const http = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const DIR = __dirname;
// Config, registro e .env ficam na pasta de dados (o Hypercube passa ROUTER_DADOS); sem ela, na pasta do script.
const DADOS = process.env.ROUTER_DADOS || DIR;
fs.mkdirSync(DADOS, { recursive: true });
carregarEnv(path.join(DADOS, '.env'));
const CFG_ARQ = path.join(DADOS, 'config.json');
if (!fs.existsSync(CFG_ARQ)) fs.copyFileSync(path.join(DIR, 'config.default.json'), CFG_ARQ);
let cfg = JSON.parse(fs.readFileSync(CFG_ARQ, 'utf8'));

const TOKEN = process.env.ROUTER_TOKEN || '';
if (TOKEN.length < 24) {
  console.error('ROUTER_TOKEN ausente ou curto (o Hypercube gera e passa o token).');
  process.exit(1);
}
const HOST = '127.0.0.1';
const PORT = Number(process.env.ROUTER_PORT || cfg.port || 8765);
const LIMITE_CORPO = 2 * 1024 * 1024;
const LOG = path.join(DADOS, 'logs', 'uso.jsonl');
fs.mkdirSync(path.dirname(LOG), { recursive: true });
// Pasta vazia usada como diretório de trabalho das CLIs, para não lerem arquivos de projeto.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'roteador-ia-'));

const cooldown = new Map(); // provider -> timestamp até quando pular
const ocupados = new Map(); // provider -> chamadas em andamento
const fila = new Map();     // provider -> [resolve]

class ErroProvedor extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

function carregarEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const tirarAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');

function textoDe(conteudo) {
  if (typeof conteudo === 'string') return conteudo;
  if (Array.isArray(conteudo)) return conteudo.map((p) => (p && p.text) || '').join('\n');
  return '';
}

function paraPrompt(mensagens) {
  if (mensagens.length === 1 && mensagens[0].role === 'user') return textoDe(mensagens[0].content);
  const rotulo = { system: 'Instruções', assistant: 'Resposta anterior', user: 'Usuário' };
  return mensagens
    .map((m) => `[${rotulo[m.role] || m.role}]\n${textoDe(m.content)}`)
    .join('\n\n');
}

// Semáforo simples por provedor.
async function adquirir(nome, max) {
  if ((ocupados.get(nome) || 0) >= max) {
    await new Promise((r) => { if (!fila.has(nome)) fila.set(nome, []); fila.get(nome).push(r); });
  }
  ocupados.set(nome, (ocupados.get(nome) || 0) + 1);
}
function liberar(nome) {
  ocupados.set(nome, ocupados.get(nome) - 1);
  const prox = (fila.get(nome) || []).shift();
  if (prox) prox();
}

// Acha uma CLI no PATH. No Windows os programas do npm são atalhos .cmd, que o Node não abre direto:
// lê o atalho e devolve o executável (ou o .js, rodado pelo Node) para onde ele aponta.
const achados = new Map();
function resolverCli(nome) {
  if (achados.has(nome)) return achados.get(nome);
  let r = null;
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['.exe', '.com', '.cmd', ''] : [''];
  procura: for (const d of dirs) {
    for (const e of exts) {
      const f = path.join(d, nome + e);
      if (!fs.existsSync(f) || !fs.statSync(f).isFile()) continue;
      if (e !== '.cmd') { r = { cmd: f, pre: [] }; break procura; }
      const todos = [...fs.readFileSync(f, 'utf8').matchAll(/%dp0%[\\/]([^"\r\n]+)"/gi)];
      const m = todos[todos.length - 1]; // o último é o programa; o primeiro pode ser o node.exe ao lado
      if (!m) continue;
      const alvo = path.join(d, m[1].split(/[\\/]/).join(path.sep));
      if (alvo.endsWith('.js')) r = { cmd: process.execPath, pre: [alvo] };
      else if (fs.existsSync(alvo + '.exe')) r = { cmd: alvo + '.exe', pre: [] };
      else if (fs.existsSync(alvo)) r = { cmd: alvo, pre: [] };
      if (r) break procura;
    }
  }
  if (r) achados.set(nome, r);
  return r;
}

function rodarCliNome(nome, args, entrada, timeoutMs) {
  const c = resolverCli(nome);
  if (!c) throw new ErroProvedor(`${nome} não encontrado no PATH`);
  return rodarCli(c.cmd, [...c.pre, ...args], entrada, timeoutMs);
}

function rodarCli(cmd, args, entrada, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: SANDBOX, windowsHide: true, env: process.env });
    let out = '';
    let err = '';
    const t = setTimeout(() => { p.kill(); reject(new ErroProvedor('timeout')); }, timeoutMs);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(t); reject(new ErroProvedor(e.message)); });
    p.on('close', (codigo) => {
      clearTimeout(t);
      const limpo = tirarAnsi(out).trim();
      if (limpo) return resolve(limpo);
      reject(new ErroProvedor(`sem resposta (código ${codigo}): ${tirarAnsi(err).trim().slice(-300)}`));
    });
    p.stdin.on('error', () => {});
    p.stdin.end(entrada);
  });
}

async function chamarOpenAI(prov, modelo, corpo) {
  const headers = { 'content-type': 'application/json' };
  if (prov.chaveEnv) {
    const chave = process.env[prov.chaveEnv];
    if (!chave) throw new ErroProvedor(`variável ${prov.chaveEnv} não definida`);
    headers.authorization = `Bearer ${chave}`;
  }
  const payload = { model: modelo, messages: corpo.messages, stream: false };
  for (const k of ['temperature', 'max_tokens', 'top_p', 'stop', 'response_format']) {
    if (corpo[k] !== undefined) payload[k] = corpo[k];
  }
  let res;
  try {
    res = await fetch(`${prov.baseUrl}/chat/completions`, {
      method: 'POST', headers, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(prov.timeoutSegundos * 1000),
    });
  } catch (e) {
    throw new ErroProvedor(e.name === 'TimeoutError' ? 'timeout' : e.message);
  }
  const txt = await res.text();
  if (!res.ok) throw new ErroProvedor(`${res.status} ${txt.slice(0, 200)}`, res.status);
  const j = JSON.parse(txt);
  return { conteudo: (j.choices && j.choices[0] && j.choices[0].message.content) || '', uso: j.usage };
}

// Ollama pela API nativa, com raciocínio desligado (qwen3.5 pensando leva minutos em CPU).
async function chamarOllama(prov, modelo, corpo) {
  const payload = { model: modelo, messages: corpo.messages.map((m) => ({ role: m.role, content: textoDe(m.content) })), stream: false, think: false };
  const options = {};
  if (corpo.temperature !== undefined) options.temperature = corpo.temperature;
  if (corpo.max_tokens !== undefined) options.num_predict = corpo.max_tokens;
  if (Object.keys(options).length) payload.options = options;
  let res;
  try {
    res = await fetch(`${prov.baseUrl}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(prov.timeoutSegundos * 1000),
    });
  } catch (e) {
    throw new ErroProvedor(e.name === 'TimeoutError' ? 'timeout' : e.message);
  }
  const txt = await res.text();
  if (!res.ok) throw new ErroProvedor(`${res.status} ${txt.slice(0, 200)}`, res.status);
  const j = JSON.parse(txt);
  return { conteudo: (j.message && j.message.content) || '', uso: { prompt_tokens: j.prompt_eval_count, completion_tokens: j.eval_count } };
}

async function chamar(nomeProv, modelo, corpo) {
  const prov = cfg.providers[nomeProv];
  const timeout = prov.timeoutSegundos * 1000;
  if (prov.tipo === 'openai') return chamarOpenAI(prov, modelo, corpo);
  if (prov.tipo === 'ollama') return chamarOllama(prov, modelo, corpo);
  const prompt = paraPrompt(corpo.messages);
  if (prov.tipo === 'kiro-cli') {
    const args = ['chat', '--no-interactive', '--model', modelo, '--trust-tools='];
    return { conteudo: await rodarCliNome(prov.bin, args, prompt, timeout) };
  }
  if (prov.tipo === 'opencode-cli') {
    // Agente "plan" = sem edição de arquivos; roda na pasta vazia do SANDBOX. Saída em eventos JSON, um por linha.
    const args = ['run', '-m', `opencode/${modelo}`, '--agent', 'plan', '--format', 'json', '--pure'];
    const bruto = await rodarCliNome(prov.bin, args, prompt, timeout);
    let texto = '';
    let erro = '';
    for (const linha of bruto.split(/\r?\n/)) {
      let ev;
      try { ev = JSON.parse(linha); } catch { continue; }
      if (ev.type === 'text' && ev.part && ev.part.text) texto += ev.part.text;
      if (ev.type === 'error') erro = JSON.stringify(ev.error || ev).slice(0, 300);
    }
    if (!texto.trim()) {
      const status = /rate|limit|429/i.test(erro) ? 429 : undefined;
      throw new ErroProvedor(erro || 'resposta vazia', status);
    }
    return { conteudo: texto };
  }
  if (prov.tipo === 'gemini-cli') {
    const args = ['-p', ' ', '--approval-mode', 'plan'];
    if (modelo !== 'padrao') args.push('-m', modelo);
    return { conteudo: await rodarCliNome(prov.bin || 'gemini', args, prompt, timeout) };
  }
  throw new ErroProvedor(`tipo desconhecido: ${prov.tipo}`);
}

function resolverAlvos(pedido) {
  if (cfg.cadeias[pedido]) return cfg.cadeias[pedido];
  return [pedido];
}

function separar(alvo) {
  const i = alvo.indexOf('/');
  if (i < 0) return null;
  const nomeProv = alvo.slice(0, i);
  const modelo = alvo.slice(i + 1);
  const prov = cfg.providers[nomeProv];
  if (!prov || !prov.models.includes(modelo)) return null;
  return { nomeProv, modelo };
}

async function rotear(corpo, origem) {
  const tentativas = [];
  for (const alvo of resolverAlvos(corpo.model)) {
    // Delegação do Claude nunca usa o Ollama (regra do projeto).
    if (origem === 'claude' && alvo.startsWith('ollama/')) { tentativas.push({ modelo: alvo, erro: 'Ollama fora da delegação do Claude' }); continue; }
    const s = separar(alvo);
    if (!s) { tentativas.push({ modelo: alvo, erro: 'modelo não liberado no config.json' }); continue; }
    if ((cooldown.get(s.nomeProv) || 0) > Date.now()) {
      tentativas.push({ modelo: alvo, erro: 'provedor em pausa (limite recente)' });
      continue;
    }
    const prov = cfg.providers[s.nomeProv];
    const t0 = Date.now();
    await adquirir(s.nomeProv, prov.concorrencia || 1);
    try {
      const r = await chamar(s.nomeProv, s.modelo, corpo);
      if (!r.conteudo.trim()) throw new ErroProvedor('resposta vazia');
      tentativas.push({ modelo: alvo, ms: Date.now() - t0, ok: true });
      return { ...r, usado: alvo, tentativas };
    } catch (e) {
      if ([401, 403, 429].includes(e.status)) cooldown.set(s.nomeProv, Date.now() + cfg.cooldownSegundos * 1000);
      tentativas.push({ modelo: alvo, ms: Date.now() - t0, erro: e.message });
    } finally {
      liberar(s.nomeProv);
    }
  }
  const err = new Error('todos os modelos falharam');
  err.tentativas = tentativas;
  throw err;
}

function registrar(obj) {
  fs.appendFile(LOG, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n', () => {});
}

function responder(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function autorizado(req) {
  const h = req.headers.authorization || '';
  const recebido = Buffer.from(h.startsWith('Bearer ') ? h.slice(7) : '');
  const esperado = Buffer.from(TOKEN);
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tam = 0;
    const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > LIMITE_CORPO) { reject(new Error('corpo grande demais')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

const hostsOk = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
// Única origem de navegador aceita: o próprio painel (mesma origem).
const origensOk = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
const INICIO = Date.now();

function lerLog(max = 3000) {
  if (!fs.existsSync(LOG)) return [];
  const linhas = fs.readFileSync(LOG, 'utf8').trim().split(/\r?\n/).slice(-max);
  const out = [];
  for (const l of linhas) { try { out.push(JSON.parse(l)); } catch {} }
  return out;
}

function estatisticas() {
  const reg = lerLog();
  const porModelo = {};
  const item = (m) => (porModelo[m] ||= { ok: 0, falhas: 0, msTotal: 0, ultimoErro: null });
  for (const r of reg) {
    for (const t of r.tentativas || []) {
      if (t.erro && t.erro.startsWith('provedor em pausa')) continue;
      if (t.erro === 'modelo não liberado no config.json') continue;
      const it = item(t.modelo);
      if (t.ok) { it.ok++; it.msTotal += t.ms || 0; } else { it.falhas++; it.ultimoErro = { ts: r.ts, erro: String(t.erro).slice(0, 160) }; }
    }
  }
  const hoje = new Date().toDateString(); // dia local, não UTC
  const deHoje = reg.filter((r) => new Date(r.ts).toDateString() === hoje);
  const doClaude = deHoje.filter((r) => r.origem === 'claude' && !r.erro);
  // Estimativa: o Claude não leu a entrada, só a resposta. ~4 caracteres por token.
  const delegado = {
    hoje: doClaude.length,
    tokensEvitados: Math.max(0, Math.round(doClaude.reduce((n, r) => n + (r.entradaChars || 0) - (r.saidaChars || 0), 0) / 4)),
  };
  return {
    delegado,
    total: reg.length,
    hoje: deHoje.length,
    hojeErros: deHoje.filter((r) => r.erro).length,
    porModelo,
    recentes: reg.slice(-25).reverse().map((r) => ({
      ts: r.ts, pedido: r.pedido, origem: r.origem || 'cli', usado: r.usado || null, ms: r.ms, erro: r.erro || null,
      falhas: (r.tentativas || []).filter((t) => !t.ok).length,
    })),
  };
}

async function estadoProvedores() {
  const out = {};
  for (const [nome, p] of Object.entries(cfg.providers)) {
    let pronto = true; let nota = '';
    if (p.tipo === 'openai' && p.chaveEnv && !process.env[p.chaveEnv]) { pronto = false; nota = `falta ${p.chaveEnv}`; }
    if (/-cli$/.test(p.tipo)) {
      const nomeBin = p.bin || (p.tipo === 'gemini-cli' ? 'gemini' : '');
      if (!resolverCli(nomeBin)) { pronto = false; nota = `${nomeBin} não está instalado`; }
    }
    if (p.tipo === 'ollama') {
      try { await fetch(`${p.baseUrl}/api/tags`, { signal: AbortSignal.timeout(800) }); } catch { pronto = false; nota = 'Ollama desligado'; }
    }
    const ate = cooldown.get(nome) || 0;
    out[nome] = {
      tipo: p.tipo, models: p.models, pronto, nota,
      pausaSegundos: ate > Date.now() ? Math.ceil((ate - Date.now()) / 1000) : 0,
      ocupados: ocupados.get(nome) || 0, concorrencia: p.concorrencia || 1,
    };
  }
  return out;
}

function salvarCadeias(novas) {
  if (!novas || typeof novas !== 'object' || Array.isArray(novas)) throw new Error('formato inválido');
  const limpo = {};
  for (const [nome, lista] of Object.entries(novas)) {
    if (!/^[a-z0-9-]{1,30}$/.test(nome)) throw new Error(`nome de cadeia inválido: ${nome}`);
    if (!Array.isArray(lista) || !lista.length) throw new Error(`cadeia ${nome} vazia`);
    for (const alvo of lista) if (typeof alvo !== 'string' || !separar(alvo)) throw new Error(`modelo não liberado: ${alvo}`);
    limpo[nome] = [...new Set(lista)];
  }
  const novo = { ...cfg, cadeias: limpo };
  fs.writeFileSync(CFG_ARQ, JSON.stringify(novo, null, 2) + '\n');
  cfg = novo;
}

const PAINEL = path.join(DIR, 'painel.html');
function servirPainel(res) {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'",
  });
  res.end(fs.readFileSync(PAINEL));
}

const servidor = http.createServer(async (req, res) => {
  // Bloqueia navegador (Origin) e DNS rebinding (Host diferente de localhost).
  if (!hostsOk.has(req.headers.host)) return responder(res, 403, { error: 'proibido' });
  if (req.headers.origin && !origensOk.has(req.headers.origin)) return responder(res, 403, { error: 'proibido' });
  const url = req.url.split('?')[0];
  if (req.method === 'GET' && url === '/saude') return responder(res, 200, { ok: true });
  if (req.method === 'GET' && (url === '/' || url === '/painel')) return servirPainel(res);
  if (!autorizado(req)) return responder(res, 401, { error: 'token inválido' });

  if (req.method === 'GET' && url === '/painel/api/estado') {
    return responder(res, 200, {
      porta: PORT, ligadoDesde: new Date(INICIO).toISOString(), cooldownSegundos: cfg.cooldownSegundos,
      provedores: await estadoProvedores(), cadeias: cfg.cadeias, stats: estatisticas(),
    });
  }
  if (req.method === 'PUT' && url === '/painel/api/cadeias') {
    try { salvarCadeias(JSON.parse(await lerCorpo(req))); } catch (e) { return responder(res, 400, { error: e.message }); }
    return responder(res, 200, { ok: true, cadeias: cfg.cadeias });
  }
  // Visão resumida para o painel do Hypercube.
  if (req.method === 'GET' && url === '/painel/api/hypercube') {
    const st = estatisticas();
    const provs = await estadoProvedores();
    const reg = lerLog();
    const hoje = new Date().toDateString();
    const doDia = reg.filter((r) => new Date(r.ts).toDateString() === hoje && r.usado);
    return responder(res, 200, {
      endereco: `${HOST}:${PORT}`,
      ligado: true,
      provedores: Object.entries(provs).map(([id, p]) => {
        const meus = doDia.filter((r) => r.usado.startsWith(`${id}/`));
        const tempos = Object.entries(st.porModelo).filter(([m, v]) => m.startsWith(`${id}/`) && v.ok).map(([, v]) => v.msTotal / v.ok);
        return {
          id, nome: id.charAt(0).toUpperCase() + id.slice(1), ligado: p.pronto, nota: p.nota, pausaSegundos: p.pausaSegundos,
          chamadasHoje: meus.length, cotaDiaria: 0,
          latenciaMs: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0,
        };
      }),
      cadeias: cfg.cadeias,
      chamadas: st.recentes.map((r) => ({
        momento: Date.parse(r.ts), nivel: r.pedido, provedor: r.usado ? r.usado.split('/')[0] : '', modelo: r.usado || '',
        tokens: 0, ms: r.ms || 0, ok: !r.erro,
      })),
    });
  }
  if (req.method === 'PUT' && url === '/painel/api/cadeia') {
    try {
      const { nivel, lista } = JSON.parse(await lerCorpo(req));
      salvarCadeias({ ...cfg.cadeias, [nivel]: lista });
    } catch (e) { return responder(res, 400, { error: e.message }); }
    return responder(res, 200, { ok: true });
  }
  if (req.method === 'POST' && url === '/painel/api/liberar-pausa') {
    cooldown.clear();
    return responder(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url === '/v1/models') {
    const ids = [...Object.keys(cfg.cadeias)];
    for (const [n, p] of Object.entries(cfg.providers)) for (const m of p.models) ids.push(`${n}/${m}`);
    return responder(res, 200, { object: 'list', data: ids.map((id) => ({ id, object: 'model', owned_by: 'roteador-ia' })) });
  }

  if (req.method === 'POST' && url === '/v1/chat/completions') {
    let corpo;
    try { corpo = JSON.parse(await lerCorpo(req)); } catch (e) { return responder(res, 400, { error: `JSON inválido: ${e.message}` }); }
    if (!corpo || typeof corpo.model !== 'string' || !Array.isArray(corpo.messages) || !corpo.messages.length) {
      return responder(res, 400, { error: 'informe model e messages' });
    }
    if (corpo.tools) return responder(res, 400, { error: 'tools ainda não suportado por este roteador' });
    const origem = String(req.headers['x-origem'] || 'cli').slice(0, 20);
    const entradaChars = corpo.messages.reduce((n, m) => n + textoDe(m.content).length, 0);
    const t0 = Date.now();
    try {
      const r = await rotear(corpo, origem);
      registrar({ pedido: corpo.model, usado: r.usado, ms: Date.now() - t0, tentativas: r.tentativas, origem, entradaChars, saidaChars: r.conteudo.length });
      const id = `chatcmpl-${crypto.randomBytes(8).toString('hex')}`;
      const criado = Math.floor(Date.now() / 1000);
      if (corpo.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
        const chunk = (delta, fim) => `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: criado, model: r.usado, choices: [{ index: 0, delta, finish_reason: fim }] })}\n\n`;
        res.write(chunk({ role: 'assistant', content: r.conteudo }, null));
        res.write(chunk({}, 'stop'));
        return res.end('data: [DONE]\n\n');
      }
      return responder(res, 200, {
        id, object: 'chat.completion', created: criado, model: r.usado,
        choices: [{ index: 0, message: { role: 'assistant', content: r.conteudo }, finish_reason: 'stop' }],
        usage: r.uso, roteador: { tentativas: r.tentativas },
      });
    } catch (e) {
      registrar({ pedido: corpo.model, ms: Date.now() - t0, erro: e.message, tentativas: e.tentativas, origem, entradaChars });
      return responder(res, 502, { error: e.message, tentativas: e.tentativas });
    }
  }
  return responder(res, 404, { error: 'rota não encontrada' });
});

servidor.listen(PORT, HOST, () => console.log(`roteador-ia ouvindo em http://${HOST}:${PORT}`));
