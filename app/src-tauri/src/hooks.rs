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
    // "Claude is waiting for your input" chega depois de um minuto parado: não é pedido, o agente está pronto.
    if tipo == "Notification" {
        let ocioso = texto("notification_type").is_some_and(|t| t == "idle_prompt")
            || texto("message").is_some_and(|m| m.to_lowercase().contains("waiting for your input"));
        if ocioso {
            return None;
        }
    }
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
    let id = url.strip_prefix("/hook/").or_else(|| url.strip_prefix("/status/")).ok_or(404u16)?;
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
            if req.url().starts_with("/status/") {
                // Linha de status do Claude Code: traz o uso do plano. Responde a linha que o terminal mostra.
                let v = serde_json::from_slice::<Value>(&corpo).unwrap_or(Value::Null);
                if let Some(u) = uso_da_linha_de_status(&v) {
                    *ULTIMO_USO.lock().unwrap() = Some(u.clone());
                    let _ = app.emit("uso_plano", u);
                }
                let _ = req.respond(tiny_http::Response::from_string(linha_de_status(&v)));
                continue;
            }
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
    let status = format!(
        "curl -s --max-time 2 -X POST -H \"Content-Type: application/json\" -H \"{HEADER_TOKEN}: {token}\" --data-binary @- http://127.0.0.1:{porta}/status/{terminal_id}"
    );
    let caminho = dir.join(format!("hooks-{terminal_id}.json"));
    std::fs::write(
        &caminho,
        serde_json::to_vec_pretty(&serde_json::json!({
            "hooks": hooks,
            "statusLine": { "type": "command", "command": status, "padding": 0 }
        }))?,
    )?;
    Ok(caminho)
}

// ---------- uso do plano (vem da linha de status do Claude Code) ----------

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UsoPlano {
    pub provedor: String,
    pub cinco_horas: u32,
    pub semana: u32,
    pub renova_em: String,
}

pub static ULTIMO_USO: Mutex<Option<UsoPlano>> = Mutex::new(None);

fn porcentagem(janela: &Value) -> Option<f64> {
    ["used_percentage", "utilization", "percent_used"].iter().find_map(|k| janela.get(*k).and_then(Value::as_f64))
}

/// Segundos Unix de `resets_at` (número ou texto ISO 8601 em UTC).
fn reseta_em(janela: &Value) -> Option<u64> {
    let r = janela.get("resets_at")?;
    if let Some(n) = r.as_f64() {
        return Some(if n > 1e12 { (n / 1000.0) as u64 } else { n as u64 });
    }
    let t = r.as_str()?;
    // AAAA-MM-DDTHH:MM:SS…
    let n = |a: usize, b: usize| t.get(a..b)?.parse::<i64>().ok();
    let (ano, mes, dia, h, m, seg) = (n(0, 4)?, n(5, 7)?, n(8, 10)?, n(11, 13)?, n(14, 16)?, n(17, 19).unwrap_or(0));
    let (a, mm) = if mes <= 2 { (ano - 1, mes + 9) } else { (ano, mes - 3) };
    let era = a.div_euclid(400);
    let ano_era = a - era * 400;
    let dia_ano = (153 * mm + 2) / 5 + dia - 1;
    let dia_era = ano_era * 365 + ano_era / 4 - ano_era / 100 + dia_ano;
    let dias = era * 146097 + dia_era - 719468;
    Some((dias * 86400 + h * 3600 + m * 60 + seg).max(0) as u64)
}

fn texto_tempo(segundos: u64) -> String {
    let (d, h, m) = (segundos / 86400, (segundos % 86400) / 3600, (segundos % 3600) / 60);
    if d > 0 { format!("{d} d {h} h") } else if h > 0 { format!("{h} h {m:02} min") } else { format!("{m} min") }
}

pub fn uso_da_linha_de_status(v: &Value) -> Option<UsoPlano> {
    let lim = v.get("rate_limits")?;
    let cinco = lim.get("five_hour")?;
    let semana = lim.get("seven_day");
    let agora = agora_ms() / 1000;
    Some(UsoPlano {
        provedor: "Claude".into(),
        cinco_horas: porcentagem(cinco)?.round().clamp(0.0, 100.0) as u32,
        semana: semana.and_then(porcentagem).unwrap_or(0.0).round().clamp(0.0, 100.0) as u32,
        renova_em: reseta_em(cinco).map(|r| texto_tempo(r.saturating_sub(agora))).unwrap_or_else(|| "—".into()),
    })
}

/// O que aparece embaixo do terminal do Claude (substitui a linha de status só nesta sessão).
pub fn linha_de_status(v: &Value) -> String {
    let modelo = v.pointer("/model/display_name").and_then(Value::as_str).unwrap_or("Claude");
    match uso_da_linha_de_status(v) {
        Some(u) => format!("Hypercube · {modelo} · {}% das 5 h (renova em {})", u.cinco_horas, u.renova_em),
        None => format!("Hypercube · {modelo}"),
    }
}

#[cfg(test)]
mod testes_uso {
    use super::*;
    #[test]
    fn le_uso_da_linha_de_status() {
        let v = serde_json::json!({ "model": { "display_name": "Opus" }, "rate_limits": {
            "five_hour": { "used_percentage": 41.6, "resets_at": agora_ms() / 1000 + 7800 },
            "seven_day": { "used_percentage": 12 } } });
        let u = uso_da_linha_de_status(&v).unwrap();
        assert_eq!((u.cinco_horas, u.semana), (42, 12));
        assert!(u.renova_em.starts_with("2 h 1") || u.renova_em.starts_with("2 h 0"), "{}", u.renova_em);
        assert!(uso_da_linha_de_status(&serde_json::json!({})).is_none());
    }
    #[test]
    fn data_iso() {
        assert_eq!(reseta_em(&serde_json::json!({ "resets_at": "2026-11-20T00:00:00Z" })), Some(1795132800));
    }
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

#[cfg(test)]
mod testes_ocioso {
    #[test]
    fn aviso_de_ocioso_nao_vira_espera() {
        let v = serde_json::json!({ "hook_event_name": "Notification", "message": "Claude is waiting for your input" });
        assert!(super::para_evento("t1", &v).is_none());
        let p = serde_json::json!({ "hook_event_name": "Notification", "message": "Claude needs your permission to use Write" });
        assert!(super::para_evento("t1", &p).is_some());
    }
}
