//! Terminais de verdade (portable-pty: ConPTY no Windows).
//!
//! A saída vai para a interface pelo evento `terminal_saida` ({ id, dados }) e fica
//! guardada (até ~200 mil caracteres) para redesenhar o terminal ao reabrir.
use crate::hooks;
use crate::processos;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

const LIMITE_HISTORICO: usize = 200_000;
const CORTE_HISTORICO: usize = 150_000;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpcoesTerminal {
    pub agente: String,
    pub pasta: String,
    pub rotulo: String,
    pub worktree: Option<String>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    /// Primeira tarefa. No Claude e no Codex vai como argumento (o agente espera a pasta
    /// ser liberada e só então começa); nos outros, é digitada quando o terminal abre.
    #[serde(default)]
    pub tarefa: Option<String>,
    /// Instrução do papel (o arquivo do papel). No Claude vai como prompt de sistema; nos
    /// outros a interface já juntou com a primeira tarefa.
    #[serde(default)]
    pub instrucao: Option<String>,
    /// Modelo escolhido pelo nível (cada agente tem os seus nomes).
    #[serde(default)]
    pub modelo: Option<String>,
    /// Papéis que só leem (Batedor, Revisor): o agente abre em modo só leitura.
    #[serde(default)]
    pub so_leitura: bool,
    /// Esforço de raciocínio pelo nível (Codex: low, medium, high).
    #[serde(default)]
    pub esforco: Option<String>,
    /// Líder: ganha as ferramentas do Hypercube (servidor MCP local) para chamar outros agentes.
    #[serde(default)]
    pub orquestrar: bool,
}

/// Texto que o Claude Code mostra quando a pasta ainda não foi liberada.
pub const PEDIDO_CONFIAR: &str = "Confiar nesta pasta? O agente quer sua permissão para ler, editar e rodar arquivos aqui.";

/// Tira as sequências de controle do terminal para procurar texto na saída.
pub fn texto_limpo(s: &str) -> String {
    let mut r = String::with_capacity(s.len());
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        if c == '\x1b' {
            if it.peek() == Some(&'[') {
                it.next();
                while let Some(&d) = it.peek() {
                    it.next();
                    if ('@'..='~').contains(&d) {
                        break;
                    }
                }
            } else {
                it.next();
            }
            r.push(' ');
        } else if !c.is_control() || c == '\n' {
            r.push(c);
        }
    }
    r
}

pub fn pede_confiar(saida: &str) -> bool {
    let t: String = texto_limpo(saida).split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase();
    t.contains("trust this folder") || t.contains("do you trust the files")
}

#[derive(Serialize, Clone)]
pub struct Saida {
    pub id: String,
    pub dados: String,
}

#[derive(Serialize, Clone)]
pub struct Fim {
    pub id: String,
    pub codigo: u32,
}

struct Terminal {
    escritor: Arc<Mutex<Box<dyn Write + Send>>>,
    mestre: Box<dyn MasterPty + Send>,
    matador: Box<dyn ChildKiller + Send + Sync>,
    historico: Arc<Mutex<String>>,
    /// Arquivos temporários do terminal (settings e mcp do Claude, papel), apagados ao encerrar.
    temporarios: Vec<PathBuf>,
    /// Quando o terminal mostrou algo pela última vez (ms desde 1970).
    ultima_saida: Arc<AtomicU64>,
}

/// Escreve o texto e, um instante depois, o Enter. Mandar os dois juntos faz o Codex e o
/// Gemini tratarem tudo como colagem, e o Enter vira quebra de linha em vez de enviar.
pub fn digitar(escritor: &Arc<Mutex<Box<dyn Write + Send>>>, texto: &str) -> Result<(), String> {
    {
        let mut w = escritor.lock().map_err(|e| e.to_string())?;
        w.write_all(texto.as_bytes()).and_then(|_| w.flush()).map_err(|e| e.to_string())?;
    }
    std::thread::sleep(std::time::Duration::from_millis(350));
    let mut w = escritor.lock().map_err(|e| e.to_string())?;
    w.write_all(b"\r").and_then(|_| w.flush()).map_err(|e| e.to_string())
}

/// Texto que mostra que o campo de mensagem do agente já está na tela.
fn campo_pronto(agente: &str, t: &str) -> bool {
    match agente {
        "gemini" => t.contains("type your message"),
        "codex" => t.contains("ask codex"),
        _ => false,
    }
}

#[derive(Default)]
pub struct Terminais {
    mapa: Mutex<HashMap<String, Terminal>>,
    proximo: AtomicU64,
}

/// Programa e argumentos de cada agente.
fn programa(agente: &str) -> Result<(PathBuf, Vec<String>), String> {
    if agente == "terminal" {
        #[cfg(windows)]
        let shell = processos::resolver("pwsh").or_else(|| processos::resolver("powershell"));
        #[cfg(not(windows))]
        let shell = std::env::var_os("SHELL").map(PathBuf::from).or_else(|| Some(PathBuf::from("/bin/bash")));
        return shell.map(|s| (s, vec![])).ok_or_else(|| "Nenhum shell encontrado".into());
    }
    if !processos::AGENTES.contains(&agente) {
        return Err(format!("Agente desconhecido: {agente}"));
    }
    let p = processos::resolver(agente).ok_or_else(|| format!("{agente} não está instalado (não achei no PATH)"))?;
    Ok((p, vec![]))
}

/// Modelo e modo só leitura, com as opções de cada programa.
fn papel_e_nivel(o: &OpcoesTerminal, args: &mut Vec<String>) {
    let modelo = o.modelo.as_deref().filter(|m| !m.is_empty());
    let (opcao_modelo, leitura): (&str, &[&str]) = match o.agente.as_str() {
        "claude" => ("--model", &["--permission-mode", "plan"]),
        "codex" => ("-m", &["-s", "read-only"]),
        "gemini" => ("-m", &["--approval-mode", "plan"]),
        _ => return,
    };
    if let Some(m) = modelo {
        args.push(opcao_modelo.into());
        args.push(m.into());
    } else if o.agente == "codex" {
        // O modelo do config.toml pode não valer para a conta (o Codex fecha com erro): usa um que vale.
        if let Some(m) = processos::modelo_codex_reserva() {
            args.push("-m".into());
            args.push(m);
        }
    }
    if o.agente == "codex" {
        if let Some(e) = o.esforco.as_deref().filter(|e| ["low", "medium", "high"].contains(e)) {
            args.push("-c".into());
            args.push(format!("model_reasoning_effort=\"{e}\""));
        }
    }
    if o.so_leitura {
        args.extend(leitura.iter().map(|x| x.to_string()));
    }
}

/// A cópia do agente (worktree) ou a pasta do projeto. Se nenhuma existe, recusa: abrir o
/// agente em outra pasta (a do usuário, por exemplo) o faria mexer no lugar errado.
fn pasta_de_trabalho(o: &OpcoesTerminal) -> Result<PathBuf, String> {
    for c in [o.worktree.as_deref(), Some(o.pasta.as_str())].into_iter().flatten() {
        let p = PathBuf::from(c);
        if p.is_dir() {
            return Ok(p);
        }
    }
    Err(format!("A pasta do projeto não existe: {}", o.pasta))
}

/// Último estado que o Codex marcou na tela (`ESC ] 7501 ; state=<estado>:...`), se houver.
pub fn estado_codex(texto: &str) -> Option<&str> {
    let i = texto.rfind("7501;state=")?;
    let resto = &texto[i + "7501;state=".len()..];
    let fim = resto.find(|c: char| c == ':' || c == '\x1b' || c == '\x07').unwrap_or(resto.len());
    Some(&resto[..fim])
}

/// Última resposta do Codex que roda na pasta `cwd`: o Codex grava cada sessão em
/// `~/.codex/sessions/AAAA/MM/DD/rollout-*.jsonl`, com a pasta no começo e a última mensagem
/// em cada `task_complete`. Só olha sessões mexidas depois de `desde`.
pub fn ultima_resposta_codex(cwd: &std::path::Path, desde: std::time::SystemTime) -> Option<String> {
    let casa = PathBuf::from(std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })?);
    ultima_resposta_codex_em(&casa.join(".codex").join("sessions"), cwd, desde)
}

pub fn ultima_resposta_codex_em(raiz: &std::path::Path, cwd: &std::path::Path, desde: std::time::SystemTime) -> Option<String> {
    let alvo = cwd.to_string_lossy().trim_end_matches(['\\', '/']).to_lowercase();
    let mut arquivos = Vec::new();
    let mut pilha = vec![(raiz.to_path_buf(), 0)];
    while let Some((dir, nivel)) = pilha.pop() {
        for e in std::fs::read_dir(&dir).ok()?.flatten() {
            let p = e.path();
            let Ok(meta) = e.metadata() else { continue };
            if meta.is_dir() && nivel < 3 {
                pilha.push((p, nivel + 1));
            } else if meta.is_file()
                && p.extension().is_some_and(|x| x == "jsonl")
                && meta.modified().map(|m| m >= desde).unwrap_or(false)
            {
                arquivos.push((meta.modified().ok()?, p));
            }
        }
    }
    arquivos.sort_by(|a, b| b.0.cmp(&a.0));
    for (_, p) in arquivos {
        let texto = std::fs::read_to_string(&p).ok()?;
        let mut linhas = texto.lines();
        let primeira: serde_json::Value = serde_json::from_str(linhas.next()?).ok()?;
        let pasta = primeira.pointer("/payload/cwd").and_then(|v| v.as_str()).unwrap_or("");
        if pasta.trim_end_matches(['\\', '/']).to_lowercase() != alvo {
            continue;
        }
        return texto.lines().rev().find_map(|l| {
            if !l.contains("\"task_complete\"") {
                return None;
            }
            let v: serde_json::Value = serde_json::from_str(l).ok()?;
            v.pointer("/payload/last_agent_message").and_then(|m| m.as_str()).map(str::to_string)
        });
    }
    None
}

/// Da tela de um agente sem resposta limpa, guarda a partir da última entrega ("Estado: ...").
pub fn a_partir_da_entrega(tela: &str) -> &str {
    tela.rfind("Estado:").map(|i| &tela[i..]).unwrap_or(tela)
}

/// Junta os bytes lidos em texto sem cortar caracteres UTF-8 no meio.
pub fn decodificar(pendente: &mut Vec<u8>) -> String {
    match std::str::from_utf8(pendente) {
        Ok(s) => {
            let s = s.to_string();
            pendente.clear();
            s
        }
        Err(e) if e.error_len().is_none() => {
            let ok = e.valid_up_to();
            let s = String::from_utf8_lossy(&pendente[..ok]).into_owned();
            pendente.drain(..ok);
            s
        }
        Err(_) => {
            let s = String::from_utf8_lossy(pendente).into_owned();
            pendente.clear();
            s
        }
    }
}

impl Terminais {
    pub fn criar(&self, app: &AppHandle, hooks: &hooks::ServidorHooks, o: OpcoesTerminal) -> Result<String, String> {
        let id = format!("t{}-{}", hooks::agora_ms() % 1_000_000_000, self.proximo.fetch_add(1, Ordering::Relaxed));
        let (prog, mut args) = programa(&o.agente)?;
        let cwd = pasta_de_trabalho(&o)?;
        // Tarefa como argumento só quando o programa roda direto (via cmd.exe o texto viraria comando).
        let tarefa_no_argumento =
            (o.agente == "claude" || o.agente == "codex") && !processos::precisa_cmd(&prog) && o.tarefa.is_some();

        // Claude Code: hooks desta sessão num settings temporário (--settings), sem tocar no do usuário.
        let mut temporarios = Vec::new();
        let dir = std::env::temp_dir().join("hypercube").join("sessoes");
        if o.agente == "claude" {
            let p = hooks::settings_da_sessao(&dir, hooks.porta, &hooks.token, &id)
                .map_err(|e| format!("Não consegui preparar os hooks: {e}"))?;
            args.push("--settings".into());
            args.push(p.to_string_lossy().into_owned());
            temporarios.push(p);
            // Todo Claude do Hypercube ganha as ferramentas de canvas; o Líder, também as de orquestração.
            let m = hooks::mcp_da_sessao(&dir, hooks.porta, &hooks.token, &id)
                .map_err(|e| format!("Não consegui preparar as ferramentas do Hypercube: {e}"))?;
            args.push("--mcp-config".into());
            args.push(m.to_string_lossy().into_owned());
            temporarios.push(m);
            if let Some(texto) = o.instrucao.as_deref().filter(|t| !t.trim().is_empty()) {
                let arq = dir.join(format!("{id}-papel.md"));
                std::fs::write(&arq, texto).map_err(|e| format!("Não consegui preparar o papel: {e}"))?;
                args.push("--append-system-prompt-file".into());
                args.push(arq.to_string_lossy().into_owned());
                temporarios.push(arq);
            }
        }
        if o.agente == "codex" {
            // Fim de cada turno (com a última resposta) chega pelo servidor local.
            if let Some(n) = hooks::notify_codex(hooks.porta, &hooks.token, &id) {
                args.push("-c".into());
                args.push(n);
            }
            args.push("-c".into());
            args.push(format!("mcp_servers.hypercube.url={}", hooks::toml_texto(&hooks::url_mcp(hooks.porta, &id))));
            args.push("-c".into());
            args.push(format!("mcp_servers.hypercube.http_headers={{ {} = {} }}", hooks::toml_texto(hooks::HEADER_TOKEN), hooks::toml_texto(&hooks.token)));
            if o.orquestrar {
                // "esperar" segura a chamada por até 5 minutos; o padrão do Codex corta antes.
                args.push("-c".into());
                args.push(format!("mcp_servers.hypercube.tool_timeout_sec={}", hooks::ESPERA_MAX_SEG + 30));
            }
        }
        papel_e_nivel(&o, &mut args);

        let mut cmd = if processos::precisa_cmd(&prog) {
            let mut c = CommandBuilder::new("cmd.exe");
            c.args(["/d", "/c"]);
            c.arg(&prog);
            c
        } else {
            CommandBuilder::new(&prog)
        };
        cmd.args(&args);
        if tarefa_no_argumento {
            cmd.arg(o.tarefa.as_deref().unwrap_or_default());
        }
        cmd.cwd(&cwd);
        cmd.env("HYPERCUBE_TERMINAL_ID", &id);
        if o.orquestrar && o.agente == "claude" {
            // Sem isto o Claude corta a chamada da ferramenta em cerca de 1 minuto e "esperar" falha.
            cmd.env("MCP_TOOL_TIMEOUT", ((hooks::ESPERA_MAX_SEG + 30) * 1000).to_string());
        }
        // Se o Hypercube foi aberto de dentro de outro agente, o filho não herda as marcas dele.
        for k in ["CLAUDECODE", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SSE_PORT"] {
            cmd.env_remove(k);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let tamanho = PtySize { rows: o.rows.unwrap_or(30).max(2), cols: o.cols.unwrap_or(100).max(10), pixel_width: 0, pixel_height: 0 };
        let par = native_pty_system().openpty(tamanho).map_err(|e| format!("Não consegui abrir o terminal: {e}"))?;
        let mut filho = par.slave.spawn_command(cmd).map_err(|e| format!("Não consegui iniciar {}: {e}", o.agente))?;
        drop(par.slave);
        let matador = filho.clone_killer();
        let mut leitor = par.master.try_clone_reader().map_err(|e| e.to_string())?;
        let escritor: Arc<Mutex<Box<dyn Write + Send>>> =
            Arc::new(Mutex::new(par.master.take_writer().map_err(|e| e.to_string())?));
        let historico: Arc<Mutex<String>> = Arc::default();

        hooks.conhecidos.lock().unwrap().insert(id.clone());
        if o.orquestrar {
            hooks.lideres.lock().unwrap().insert(id.clone());
        }

        // Leitura da saída.
        let (app2, id2, hist2, esc2) = (app.clone(), id.clone(), historico.clone(), escritor.clone());
        // Claude, Codex e Gemini abrem perguntando se podem confiar na pasta: vira o pedido ◆.
        let olhar_confiar = matches!(o.agente.as_str(), "claude" | "codex" | "gemini");
        let ultima_saida = Arc::new(AtomicU64::new(hooks::agora_ms()));
        let ult_mapa = ultima_saida.clone();
        let campo_visto = Arc::new(AtomicBool::new(false));
        let (ult2, campo2, agente2) = (ultima_saida.clone(), campo_visto.clone(), o.agente.clone());
        let (res2, cwd2, aberto_em) = (hooks.resultados.clone(), cwd.clone(), std::time::SystemTime::now());
        std::thread::Builder::new().name(format!("pty-{id}")).spawn(move || {
            let mut buf = [0u8; 16 * 1024];
            let mut pendente = Vec::new();
            let mut cursor_respondido = false;
            let mut confiar_avisado = !olhar_confiar;
            let mut recente = String::new();
            // Começa como "parado": o primeiro "done" só vale depois de um turno começar.
            let mut codex_parado = true;
            let inicio = std::time::Instant::now();
            let mut lidos = 0usize;
            loop {
                match leitor.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        pendente.extend_from_slice(&buf[..n]);
                        let mut texto = decodificar(&mut pendente);
                        // O ConPTY abre perguntando a posição do cursor (ESC[6n) e trava até ter
                        // resposta. Respondemos aqui, uma vez, para não depender de a interface
                        // estar com o terminal aberto (e para o app conseguir fechar).
                        if !cursor_respondido {
                            if let Some(i) = texto.find("\x1b[6n") {
                                cursor_respondido = true;
                                texto.replace_range(i..i + 4, "");
                                if let Ok(mut w) = esc2.lock() {
                                    let _ = w.write_all(b"\x1b[1;1R").and_then(|_| w.flush());
                                }
                            }
                        }
                        if texto.is_empty() {
                            continue;
                        }
                        ult2.store(hooks::agora_ms(), Ordering::Relaxed);
                        lidos += texto.len();
                        // O pedido só aparece na abertura: depois disso, um texto parecido na resposta não conta.
                        if !confiar_avisado && (inicio.elapsed().as_secs() > 180 || lidos > 400_000) {
                            confiar_avisado = true;
                        }
                        // O Codex marca na tela o fim de cada turno (sequência 7501 "state=done"). Vale como
                        // o aviso de fim mesmo quando o aviso pelo servidor local não chega (por exemplo,
                        // um hook do próprio Codex que trava antes dele).
                        if agente2 == "codex" {
                            // A linha "esc to interrupt" só aparece enquanto o turno roda.
                            if texto.contains("esc to interrupt") {
                                codex_parado = false;
                            }
                            if let Some(estado) = estado_codex(&texto) {
                                let fim = estado == "done";
                                if fim != codex_parado {
                                    eprintln!("[terminais] codex {id2} estado {estado}");
                                }
                                if fim && !codex_parado {
                                    if let Some(m) = ultima_resposta_codex(&cwd2, aberto_em) {
                                        res2.lock().unwrap().insert(id2.clone(), m);
                                    }
                                    let _ = app2.emit(
                                        "evento_agente",
                                        hooks::EventoAgente {
                                            tipo: "Stop".into(),
                                            terminal_id: id2.clone(),
                                            momento: hooks::agora_ms(),
                                            ferramenta: None,
                                            mensagem: None,
                                            subagente_id: None,
                                        },
                                    );
                                }
                                codex_parado = fim;
                            }
                        }
                        if !campo2.load(Ordering::Relaxed) {
                            let t = texto_limpo(&texto).to_lowercase();
                            if campo_pronto(&agente2, &t) {
                                campo2.store(true, Ordering::Relaxed);
                            }
                        }
                        if !confiar_avisado {
                            recente.push_str(&texto);
                            if recente.len() > 8192 {
                                let mut c = recente.len() - 4096;
                                while !recente.is_char_boundary(c) {
                                    c += 1;
                                }
                                recente.drain(..c);
                            }
                            if pede_confiar(&recente) {
                                confiar_avisado = true;
                                let _ = app2.emit(
                                    "evento_agente",
                                    hooks::EventoAgente {
                                        tipo: "Notification".into(),
                                        terminal_id: id2.clone(),
                                        momento: hooks::agora_ms(),
                                        ferramenta: None,
                                        mensagem: Some(PEDIDO_CONFIAR.into()),
                                        subagente_id: None,
                                    },
                                );
                            }
                        }
                        {
                            let mut h = hist2.lock().unwrap();
                            h.push_str(&texto);
                            if h.len() > LIMITE_HISTORICO {
                                let mut corte = h.len() - CORTE_HISTORICO;
                                while !h.is_char_boundary(corte) {
                                    corte += 1;
                                }
                                h.drain(..corte);
                            }
                        }
                        let _ = app2.emit("terminal_saida", Saida { id: id2.clone(), dados: texto });
                    }
                }
            }
        }).map_err(|e| e.to_string())?;

        // Espera o processo terminar e avisa a interface.
        let (app3, id3) = (app.clone(), id.clone());
        std::thread::Builder::new().name(format!("espera-{id}")).spawn(move || {
            let codigo = filho.wait().map(|s| s.exit_code()).unwrap_or(1);
            let _ = app3.emit("terminal_fim", Fim { id: id3, codigo });
        }).map_err(|e| e.to_string())?;

        if let (false, Some(t)) = (tarefa_no_argumento, o.tarefa.clone()) {
            // Digita a primeira mensagem só quando o agente já mostra o campo de mensagem
            // (ou, nos outros, quando a tela para de mudar). Antes disso o texto se perde.
            let esc = escritor.clone();
            let precisa_campo = matches!(o.agente.as_str(), "gemini" | "codex");
            std::thread::spawn(move || {
                let comeco = std::time::Instant::now();
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(200));
                    let parado = hooks::agora_ms().saturating_sub(ultima_saida.load(Ordering::Relaxed));
                    let passou = comeco.elapsed().as_millis();
                    let pronto = if precisa_campo {
                        campo_visto.load(Ordering::Relaxed) && parado > 800
                    } else {
                        passou > 2500 && parado > 1200
                    };
                    if pronto || passou > 60_000 {
                        break;
                    }
                }
                let _ = digitar(&esc, &t);
            });
        }
        eprintln!("[terminais] criado {id} ({}, \"{}\")", o.agente, o.rotulo);
        self.mapa.lock().unwrap().insert(id.clone(), Terminal { escritor, mestre: par.master, matador, historico, temporarios, ultima_saida: ult_mapa });
        Ok(id)
    }

    pub fn escrever(&self, id: &str, dados: &str) -> Result<(), String> {
        let mut m = self.mapa.lock().unwrap();
        let t = m.get_mut(id).ok_or("Terminal não existe")?;
        let mut w = t.escritor.lock().map_err(|e| e.to_string())?;
        w.write_all(dados.as_bytes()).and_then(|_| w.flush()).map_err(|e| e.to_string())
    }

    /// Manda uma mensagem ao agente: o texto e depois o Enter (ver `digitar`).
    pub fn enviar(&self, id: &str, texto: &str) -> Result<(), String> {
        let esc = self.mapa.lock().unwrap().get(id).ok_or("Terminal não existe")?.escritor.clone();
        digitar(&esc, texto)
    }

    /// Última resposta do agente; sem ela, o fim do que o terminal mostrou, em texto limpo.
    pub fn resultado(&self, hooks: &hooks::ServidorHooks, id: &str) -> String {
        if let Some(r) = hooks.resultados.lock().unwrap().get(id) {
            return r.clone();
        }
        let h = self.historico(id);
        let limpo: Vec<String> = texto_limpo(&h)
            .lines()
            .map(|l| l.split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|l| !l.is_empty())
            .collect();
        let junto = limpo.join("\n");
        let mut fim = a_partir_da_entrega(&junto).to_string();
        if fim.len() > 4000 {
            let mut c = fim.len() - 4000;
            while !fim.is_char_boundary(c) {
                c += 1;
            }
            fim = format!("(fim da tela do terminal)\n{}", &fim[c..]);
        }
        fim
    }

    /// Há quanto tempo (ms) o terminal não mostra nada: para saber quando um agente sem hooks parou.
    pub fn ocioso_ms(&self, id: &str) -> Option<u64> {
        let m = self.mapa.lock().unwrap();
        let t = m.get(id)?;
        Some(hooks::agora_ms().saturating_sub(t.ultima_saida.load(Ordering::Relaxed)))
    }

    pub fn redimensionar(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let m = self.mapa.lock().unwrap();
        let t = m.get(id).ok_or("Terminal não existe")?;
        t.mestre
            .resize(PtySize { rows: rows.max(2), cols: cols.max(10), pixel_width: 0, pixel_height: 0 })
            .map_err(|e| e.to_string())
    }

    pub fn historico(&self, id: &str) -> String {
        self.mapa.lock().unwrap().get(id).map(|t| t.historico.lock().unwrap().clone()).unwrap_or_default()
    }

    pub fn encerrar(&self, hooks: &hooks::ServidorHooks, id: &str) -> Result<(), String> {
        let t = self.mapa.lock().unwrap().remove(id);
        hooks.conhecidos.lock().unwrap().remove(id);
        hooks.lideres.lock().unwrap().remove(id);
        if let Some(mut t) = t {
            let _ = t.matador.kill();
            for p in t.temporarios.drain(..) {
                let _ = std::fs::remove_file(p);
            }
            hooks.resultados.lock().unwrap().remove(id);
            eprintln!("[terminais] encerrado {id}");
        }
        Ok(())
    }

    pub fn encerrar_todos(&self, hooks: &hooks::ServidorHooks) {
        let ids: Vec<String> = self.mapa.lock().unwrap().keys().cloned().collect();
        for id in ids {
            let _ = self.encerrar(hooks, &id);
        }
    }
}

#[cfg(test)]
mod testes {
    #[test]
    fn le_o_estado_do_codex_na_tela() {
        assert_eq!(super::estado_codex("x\x1b]7501;state=working:app=codex\x1b\\"), Some("working"));
        assert_eq!(super::estado_codex("a]7501;state=working:app=codex b]7501;state=done:app=codex\x07"), Some("done"));
        assert_eq!(super::estado_codex("nada aqui"), None);
    }

    #[test]
    fn le_a_ultima_resposta_do_codex() {
        let raiz = std::env::temp_dir().join(format!("hc-sessoes-{}", std::process::id()));
        let dia = raiz.join("2026").join("11").join("22");
        std::fs::create_dir_all(&dia).unwrap();
        let antes = std::time::SystemTime::now() - std::time::Duration::from_secs(5);
        let meta = |cwd: &str| serde_json::json!({ "type": "session_meta", "payload": { "cwd": cwd } }).to_string();
        let fim = |m: &str| serde_json::json!({ "type": "event_msg", "payload": { "type": "task_complete", "last_agent_message": m } }).to_string();
        std::fs::write(dia.join("rollout-a.jsonl"), format!("{}\n{}\n", meta("C:\\outra"), fim("não é esta"))).unwrap();
        std::fs::write(dia.join("rollout-b.jsonl"), format!("{}\n{}\n{}\n", meta("C:\\Projeto\\wt"), fim("primeira"), fim("Estado: concluído"))).unwrap();
        let r = super::ultima_resposta_codex_em(&raiz, std::path::Path::new("c:\\projeto\\wt\\"), antes);
        assert_eq!(r.as_deref(), Some("Estado: concluído"));
        let nada = super::ultima_resposta_codex_em(&raiz, std::path::Path::new("C:\\nenhuma"), antes);
        assert!(nada.is_none());
        let _ = std::fs::remove_dir_all(&raiz);
    }

    #[test]
    fn resultado_comeca_na_ultima_entrega() {
        let tela = "lixo\nEstado: parcial\nvelho\nEstado: concluído\nPróximo: nenhum";
        assert_eq!(super::a_partir_da_entrega(tela), "Estado: concluído\nPróximo: nenhum");
        assert_eq!(super::a_partir_da_entrega("sem entrega"), "sem entrega");
    }

    use super::{decodificar, pede_confiar};

    #[test]
    fn acha_o_pedido_de_confiar() {
        let tela = "\x1b[1m Quick safety check: Is this a project you created or one you trust?\x1b[0m\r\n \x1b[2m❯\x1b[0m No, exit\r\n   Yes, I trust\x1b[22m this folder";
        assert!(pede_confiar(tela));
        assert!(!pede_confiar("Responda só com a palavra OK."));
    }

    #[test]
    fn nao_corta_utf8() {
        let bytes = "ação".as_bytes();
        let mut p = bytes[..2].to_vec(); // "a" + metade do "ç"
        assert_eq!(decodificar(&mut p), "a");
        p.extend_from_slice(&bytes[2..]);
        assert_eq!(decodificar(&mut p), "ção");
        assert!(p.is_empty());
    }
}
