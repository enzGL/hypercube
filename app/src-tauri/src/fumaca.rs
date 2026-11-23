//! Teste de fumaça, só quando a variável HYPERCUBE_FUMACA aponta para um arquivo de log.
//!
//! Abre a janela no segundo monitor (se existir), detecta os agentes, confere o servidor
//! de hooks (token, Origin, terminal desconhecido), abre um PTY de verdade e confere a saída.
//! Com HYPERCUBE_FUMACA_SAIR=1 fecha o app no fim. Nada disso roda no uso normal.
use crate::{hooks, terminais, Estado};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Listener, Manager, WebviewWindow};

static LOG: Mutex<()> = Mutex::new(());

pub fn ligada() -> bool {
    std::env::var_os("HYPERCUBE_FUMACA").is_some()
}

pub fn registrar(linha: &str) {
    let Some(caminho) = std::env::var_os("HYPERCUBE_FUMACA") else { return };
    let _g = LOG.lock();
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(caminho) {
        let _ = writeln!(f, "{linha}");
    }
}

/// Corta um texto para o log (sem quebrar caracteres), numa linha só.
pub fn curto(t: &str, max: usize) -> String {
    let t = t.replace('\r', "").replace('\n', " ⏎ ");
    if t.chars().count() <= max { t } else { format!("{}…", t.chars().take(max).collect::<String>()) }
}

/// Teste do Líder de ponta a ponta: a interface abre uma sessão de equipe na pasta e com a
/// tarefa destas variáveis e aceita sozinha os pedidos de permissão (só para projeto de teste).
pub fn lider() -> Option<serde_json::Value> {
    if !ligada() {
        return None;
    }
    let pasta = std::env::var("HYPERCUBE_FUMACA_LIDER_PASTA").ok()?;
    let tarefa = std::env::var("HYPERCUBE_FUMACA_LIDER_TAREFA").ok()?;
    let agente = std::env::var("HYPERCUBE_FUMACA_LIDER_AGENTE").unwrap_or_else(|_| "claude".into());
    let nivel = std::env::var("HYPERCUBE_FUMACA_LIDER_NIVEL").unwrap_or_else(|_| "padrao".into());
    let mensagens = std::env::var("HYPERCUBE_FUMACA_LIDER_DEPOIS").ok();
    // Outro papel no lugar do Líder (para testar um agente sozinho dentro do app).
    let papel = std::env::var("HYPERCUBE_FUMACA_LIDER_PAPEL").unwrap_or_else(|_| "lider".into());
    Some(serde_json::json!({ "pasta": pasta, "tarefa": tarefa, "agente": agente, "nivel": nivel, "depois": mensagens, "papel": papel }))
}

/// A interface chamou um comando Rust: prova de que o front carregou dentro do Tauri.
pub fn interface_chamou(chamada: &str) {
    if ligada() {
        registrar(&format!("interface: {chamada}"));
    }
}

pub fn posicionar_no_segundo_monitor(janela: &WebviewWindow) {
    let primario = janela.primary_monitor().ok().flatten().map(|m| *m.position());
    let outro = janela
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .find(|m| Some(*m.position()) != primario);
    match outro {
        Some(m) => {
            let p = m.position();
            let _ = janela.set_position(tauri::PhysicalPosition::new(p.x + 40, p.y + 40));
            registrar(&format!("janela: monitor 2 em {},{}", p.x, p.y));
        }
        None => {
            let _ = janela.minimize();
            registrar("janela: só um monitor, minimizada");
        }
    }
}

fn http(porta: u16, caminho: &str, cabecalhos: &[(&str, &str)], corpo: &str) -> String {
    let Ok(mut s) = TcpStream::connect(("127.0.0.1", porta)) else { return "sem conexão".into() };
    let _ = s.set_read_timeout(Some(Duration::from_secs(3)));
    let mut req = format!("POST {caminho} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nContent-Length: {}\r\n", corpo.len());
    for (k, v) in cabecalhos {
        req.push_str(&format!("{k}: {v}\r\n"));
    }
    req.push_str("\r\n");
    req.push_str(corpo);
    let _ = s.write_all(req.as_bytes());
    let mut r = String::new();
    let _ = s.read_to_string(&mut r);
    r.lines().next().unwrap_or("").to_string()
}

pub fn rodar(app: AppHandle) {
    std::thread::spawn(move || {
        registrar("--- fumaça ---");
        let inicio = Instant::now();
        for a in crate::processos::detectar_todos() {
            registrar(&format!(
                "agente: {} instalado={} versao={}",
                a.agente,
                a.instalado,
                a.versao.as_deref().unwrap_or("-")
            ));
        }
        registrar(&format!("deteccao: {} ms", inicio.elapsed().as_millis()));

        let estado = app.state::<Estado>();
        let (porta, token) = (estado.hooks.porta, estado.hooks.token.clone());
        estado.hooks.conhecidos.lock().unwrap().insert("fumaca".into());
        let corpo = r#"{"hook_event_name":"UserPromptSubmit","prompt":"nao deve aparecer"}"#;
        let tok = token.as_str();
        registrar(&format!("hooks: certo -> {}", http(porta, "/hook/fumaca", &[(hooks::HEADER_TOKEN, tok)], corpo)));
        registrar(&format!("hooks: sem token -> {}", http(porta, "/hook/fumaca", &[], corpo)));
        registrar(&format!(
            "hooks: com Origin -> {}",
            http(porta, "/hook/fumaca", &[(hooks::HEADER_TOKEN, tok), ("Origin", "http://exemplo.com")], corpo)
        ));
        registrar(&format!("hooks: terminal desconhecido -> {}", http(porta, "/hook/outro", &[(hooks::HEADER_TOKEN, tok)], corpo)));
        estado.hooks.conhecidos.lock().unwrap().remove("fumaca");

        let opcoes = terminais::OpcoesTerminal {
            agente: "terminal".into(),
            pasta: std::env::temp_dir().to_string_lossy().into_owned(),
            rotulo: "Fumaça".into(),
            worktree: None,
            cols: Some(100),
            rows: Some(30), tarefa: None, instrucao: None, modelo: None, so_leitura: false, esforco: None, orquestrar: false,
        };
        match estado.terminais.criar(&app, &estado.hooks, opcoes) {
            Ok(id) => {
                // Sem ninguém respondendo ao ESC[6n: prova que o Rust responde sozinho.
                std::thread::sleep(Duration::from_secs(3));
                let _ = estado.terminais.escrever(&id, "echo hypercube-$(1+1)-ok\r");
                let limite = Instant::now() + Duration::from_secs(10);
                let mut achou = false;
                while Instant::now() < limite {
                    if estado.terminais.historico(&id).contains("hypercube-2-ok") {
                        achou = true;
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(200));
                }
                let h = estado.terminais.historico(&id);
                registrar(&format!("pty: {id} saida_ok={achou} bytes={} inicio={:?}", h.len(), h.chars().take(200).collect::<String>()));
                let _ = estado.terminais.encerrar(&estado.hooks, &id);
                registrar("pty: encerrado");
            }
            Err(e) => registrar(&format!("pty: erro {e}")),
        }

        // Claude Code de verdade num PTY, com os hooks pelo --settings temporário.
        // Não manda prompt nenhum: só espera o SessionStart chegar pelo servidor de hooks.
        if let Some(pasta) = std::env::var_os("HYPERCUBE_FUMACA_CLAUDE") {
            let recebidos = Arc::new(AtomicUsize::new(0));
            let r2 = recebidos.clone();
            let ouvinte = app.listen("evento_agente", move |e| {
                r2.fetch_add(1, Ordering::Relaxed);
                registrar(&format!("claude: evento {}", e.payload()));
            });
            let o = terminais::OpcoesTerminal {
                agente: "claude".into(),
                pasta: pasta.to_string_lossy().into_owned(),
                rotulo: "Fumaça Claude".into(),
                worktree: None,
                cols: Some(120),
                rows: Some(40), tarefa: None, instrucao: None, modelo: None, so_leitura: false, esforco: None, orquestrar: false,
            };
            match estado.terminais.criar(&app, &estado.hooks, o) {
                Ok(id) => {
                    let limite = Instant::now() + Duration::from_secs(40);
                    while Instant::now() < limite && recebidos.load(Ordering::Relaxed) == 0 {
                        std::thread::sleep(Duration::from_millis(300));
                    }
                    let h = estado.terminais.historico(&id);
                    let fim: String = h.chars().rev().take(300).collect::<Vec<_>>().into_iter().rev().collect();
                    registrar(&format!("claude: {id} eventos={} bytes={} fim={fim:?}", recebidos.load(Ordering::Relaxed), h.len()));
                    let _ = estado.terminais.encerrar(&estado.hooks, &id);
                }
                Err(e) => registrar(&format!("claude: erro {e}")),
            }
            app.unlisten(ouvinte);
        }

        if std::env::var_os("HYPERCUBE_FUMACA_SAIR").is_some() {
            // Um terminal fica aberto de propósito: o app precisa fechar mesmo assim.
            let aberto = terminais::OpcoesTerminal {
                agente: "terminal".into(),
                pasta: std::env::temp_dir().to_string_lossy().into_owned(),
                rotulo: "Fica aberto".into(),
                worktree: None,
                cols: None,
                rows: None, tarefa: None, instrucao: None, modelo: None, so_leitura: false, esforco: None, orquestrar: false,
            };
            if let Ok(id) = estado.terminais.criar(&app, &estado.hooks, aberto) {
                std::thread::sleep(Duration::from_secs(2));
                registrar(&format!("pty: {id} deixado aberto"));
            }
            std::thread::sleep(Duration::from_secs(4));
            registrar("fim");
            let h = app.clone();
            std::thread::spawn(move || h.exit(0));
            std::thread::sleep(Duration::from_secs(5));
            registrar("app.exit não fechou; saindo à força");
            std::process::exit(0);
        }
    });
}
