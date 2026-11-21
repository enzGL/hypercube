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
use std::sync::atomic::{AtomicU64, Ordering};
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
}

/// Texto que o Claude Code mostra quando a pasta ainda não foi liberada.
pub const PEDIDO_CONFIAR: &str = "Confiar nesta pasta? O agente quer sua permissão para ler, editar e rodar arquivos aqui.";

/// Tira as sequências de controle do terminal para procurar texto na saída.
fn texto_limpo(s: &str) -> String {
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
    settings: Option<PathBuf>,
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

fn pasta_de_trabalho(o: &OpcoesTerminal) -> PathBuf {
    for c in [o.worktree.as_deref(), Some(o.pasta.as_str())].into_iter().flatten() {
        let p = PathBuf::from(c);
        if p.is_dir() {
            return p;
        }
    }
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
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
        // Tarefa como argumento só quando o programa roda direto (via cmd.exe o texto viraria comando).
        let tarefa_no_argumento =
            (o.agente == "claude" || o.agente == "codex") && !processos::precisa_cmd(&prog) && o.tarefa.is_some();

        // Claude Code: hooks desta sessão num settings temporário (--settings), sem tocar no do usuário.
        let mut settings = None;
        if o.agente == "claude" {
            let dir = std::env::temp_dir().join("hypercube").join("sessoes");
            let p = hooks::settings_da_sessao(&dir, hooks.porta, &hooks.token, &id)
                .map_err(|e| format!("Não consegui preparar os hooks: {e}"))?;
            args.push("--settings".into());
            args.push(p.to_string_lossy().into_owned());
            settings = Some(p);
        }

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
        cmd.cwd(pasta_de_trabalho(&o));
        cmd.env("HYPERCUBE_TERMINAL_ID", &id);
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

        // Leitura da saída.
        let (app2, id2, hist2, esc2) = (app.clone(), id.clone(), historico.clone(), escritor.clone());
        let olhar_confiar = o.agente == "claude";
        std::thread::Builder::new().name(format!("pty-{id}")).spawn(move || {
            let mut buf = [0u8; 16 * 1024];
            let mut pendente = Vec::new();
            let mut cursor_respondido = false;
            let mut confiar_avisado = !olhar_confiar;
            let mut recente = String::new();
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
            let esc = escritor.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(2500));
                if let Ok(mut w) = esc.lock() {
                    let _ = w.write_all(format!("{t}\r").as_bytes()).and_then(|_| w.flush());
                }
            });
        }
        eprintln!("[terminais] criado {id} ({}, \"{}\")", o.agente, o.rotulo);
        self.mapa.lock().unwrap().insert(id.clone(), Terminal { escritor, mestre: par.master, matador, historico, settings });
        Ok(id)
    }

    pub fn escrever(&self, id: &str, dados: &str) -> Result<(), String> {
        let mut m = self.mapa.lock().unwrap();
        let t = m.get_mut(id).ok_or("Terminal não existe")?;
        let mut w = t.escritor.lock().map_err(|e| e.to_string())?;
        w.write_all(dados.as_bytes()).and_then(|_| w.flush()).map_err(|e| e.to_string())
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
        if let Some(mut t) = t {
            let _ = t.matador.kill();
            if let Some(p) = t.settings.take() {
                let _ = std::fs::remove_file(p);
            }
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
