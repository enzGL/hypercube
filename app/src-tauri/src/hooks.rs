//! Servidor local que recebe os hooks do Claude Code.
//!
//! - Só escuta em 127.0.0.1, numa porta livre escolhida pelo sistema.
//! - Toda requisição precisa do header `X-Hypercube-Token` com o token aleatório da execução.
//! - Requisição com header `Origin` é recusada (barra páginas web abertas no navegador).
//! - O log só registra o tipo do evento e o terminal; nunca o conteúdo do prompt.
use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub const HEADER_TOKEN: &str = "X-Hypercube-Token";
const LIMITE_CORPO: u64 = 1 << 20;

pub const EVENTOS: [&str; 7] =
    ["SessionStart", "UserPromptSubmit", "PreToolUse", "Notification", "Stop", "SubagentStart", "SubagentStop"];

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EventoAgente {
    pub tipo: String,
    pub terminal_id: String,
    pub momento: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ferramenta: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mensagem: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subagente_id: Option<String>,
}

pub struct ServidorHooks {
    pub porta: u16,
    pub token: String,
    /// Terminais que podem mandar eventos (os que o app criou).
    pub conhecidos: Arc<Mutex<HashSet<String>>>,
}

pub fn agora_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn token_novo() -> String {
    let mut b = [0u8; 32];
    getrandom::fill(&mut b).expect("sem fonte de aleatoriedade");
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn iguais(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Converte o JSON do hook no evento da interface. Só pega campos de estado.
pub fn para_evento(terminal_id: &str, corpo: &Value) -> Option<EventoAgente> {
    let tipo = corpo.get("hook_event_name")?.as_str()?;
    if !EVENTOS.contains(&tipo) {
        return None;
    }
    let texto = |k: &str| corpo.get(k).and_then(Value::as_str).map(|s| s.chars().take(300).collect::<String>());
    Some(EventoAgente {
        tipo: tipo.into(),
        terminal_id: terminal_id.into(),
        momento: agora_ms(),
        ferramenta: if tipo == "PreToolUse" { texto("tool_name") } else { None },
        // Notification traz o aviso do agente ("precisa da sua permissão..."), não o prompt.
        mensagem: if tipo == "Notification" { texto("message") } else { None },
        subagente_id: if tipo.starts_with("Subagent") { texto("agent_id").or_else(|| texto("agent_type")) } else { None },
    })
}

/// Decide a resposta para uma requisição. Separado do servidor para dar para testar.
pub fn avaliar(
    metodo: &str,
    url: &str,
    tem_origin: bool,
    token: Option<&str>,
    esperado: &str,
    conhecidos: &HashSet<String>,
) -> Result<String, u16> {
    if tem_origin {
        return Err(403);
    }
    if !token.map(|t| iguais(t.as_bytes(), esperado.as_bytes())).unwrap_or(false) {
        return Err(401);
    }
    if metodo != "POST" {
        return Err(405);
    }
    let id = url.strip_prefix("/hook/").ok_or(404u16)?;
    if !conhecidos.contains(id) {
        return Err(404);
    }
    Ok(id.to_string())
}

pub fn iniciar(app: AppHandle) -> std::io::Result<ServidorHooks> {
    let servidor = tiny_http::Server::http("127.0.0.1:0").map_err(|e| std::io::Error::other(e.to_string()))?;
    let porta = servidor.server_addr().to_ip().map(|a| a.port()).unwrap_or(0);
    let token = token_novo();
    let conhecidos: Arc<Mutex<HashSet<String>>> = Arc::default();
    let (tok, conh) = (token.clone(), conhecidos.clone());
    std::thread::Builder::new().name("hooks".into()).spawn(move || {
        for mut req in servidor.incoming_requests() {
            let tem_origin = req.headers().iter().any(|h| h.field.equiv("Origin"));
            let token_req = req
                .headers()
                .iter()
                .find(|h| h.field.equiv(HEADER_TOKEN))
                .map(|h| h.value.as_str().to_string());
            let metodo = req.method().as_str().to_string();
            let veredito = {
                let c = conh.lock().unwrap();
                avaliar(&metodo, req.url(), tem_origin, token_req.as_deref(), &tok, &c)
            };
            let id = match veredito {
                Ok(id) => id,
                Err(cod) => {
                    eprintln!("[hooks] recusado {cod}");
                    let _ = req.respond(tiny_http::Response::empty(cod));
                    continue;
                }
            };
            let mut corpo = Vec::new();
            let _ = req.as_reader().take(LIMITE_CORPO).read_to_end(&mut corpo);
            let evento = serde_json::from_slice::<Value>(&corpo).ok().and_then(|v| para_evento(&id, &v));
            let _ = req.respond(tiny_http::Response::empty(200));
            if let Some(ev) = evento {
                eprintln!("[hooks] {} terminal={}", ev.tipo, ev.terminal_id);
                let _ = app.emit("evento_agente", ev);
            }
        }
    })?;
    eprintln!("[hooks] ouvindo em 127.0.0.1:{porta}");
    Ok(ServidorHooks { porta, token, conhecidos })
}

/// Settings temporário só desta sessão do Claude Code (passado com --settings).
/// Não toca no ~/.claude/settings.json do usuário.
pub fn settings_da_sessao(dir: &Path, porta: u16, token: &str, terminal_id: &str) -> std::io::Result<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let cmd = format!(
        "curl -s --max-time 3 -X POST -H \"Content-Type: application/json\" -H \"{HEADER_TOKEN}: {token}\" --data-binary @- http://127.0.0.1:{porta}/hook/{terminal_id}"
    );
    let gancho = serde_json::json!([{ "hooks": [{ "type": "command", "command": cmd, "timeout": 5 }] }]);
    let mut hooks = serde_json::Map::new();
    for ev in EVENTOS {
        let mut g = gancho.clone();
        if ev == "PreToolUse" {
            g[0]["matcher"] = Value::from("*");
        }
        hooks.insert(ev.into(), g);
    }
    let caminho = dir.join(format!("hooks-{terminal_id}.json"));
    std::fs::write(&caminho, serde_json::to_vec_pretty(&serde_json::json!({ "hooks": hooks }))?)?;
    Ok(caminho)
}

#[cfg(test)]
mod testes {
    use super::*;

    fn conh() -> HashSet<String> {
        ["t1".to_string()].into_iter().collect()
    }

    #[test]
    fn recusa_origin_token_errado_e_terminal_desconhecido() {
        let c = conh();
        assert_eq!(avaliar("POST", "/hook/t1", true, Some("abc"), "abc", &c), Err(403));
        assert_eq!(avaliar("POST", "/hook/t1", false, None, "abc", &c), Err(401));
        assert_eq!(avaliar("POST", "/hook/t1", false, Some("abd"), "abc", &c), Err(401));
        assert_eq!(avaliar("GET", "/hook/t1", false, Some("abc"), "abc", &c), Err(405));
        assert_eq!(avaliar("POST", "/hook/t9", false, Some("abc"), "abc", &c), Err(404));
        assert_eq!(avaliar("POST", "/hook/t1", false, Some("abc"), "abc", &c), Ok("t1".into()));
    }

    #[test]
    fn nao_leva_o_prompt() {
        let v = serde_json::json!({ "hook_event_name": "UserPromptSubmit", "prompt": "segredo" });
        let ev = para_evento("t1", &v).unwrap();
        let s = serde_json::to_string(&ev).unwrap();
        assert!(!s.contains("segredo"));
        assert!(s.contains("\"terminalId\":\"t1\""));
        let v = serde_json::json!({ "hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": "ls"} });
        assert_eq!(para_evento("t1", &v).unwrap().ferramenta.as_deref(), Some("Bash"));
        assert!(para_evento("t1", &serde_json::json!({ "hook_event_name": "Outro" })).is_none());
    }
}
