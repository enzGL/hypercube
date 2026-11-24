//! Roteador de IA: sobe o `router/server.js` (Node, só em 127.0.0.1) como processo filho e conversa com ele
//! pelo token. O nível "barato" dos agentes usa modelos gratuitos por ele.
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Porta própria, para não bater com outro roteador que a pessoa já use.
pub const PORTA: u16 = 18765;

#[derive(Default)]
pub struct Roteador {
    filho: Mutex<Option<Child>>,
    token: Mutex<String>,
}

fn token_novo() -> String {
    let mut b = [0u8; 24];
    getrandom::fill(&mut b).expect("sem fonte de aleatoriedade");
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// Onde está o `server.js`: ao lado do executável (versão instalada) ou na pasta `router/` do repositório (desenvolvimento).
fn achar_script() -> Option<PathBuf> {
    let mut candidatos: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(d) = exe.parent() {
            candidatos.push(d.join("router").join("server.js"));
        }
    }
    candidatos.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..").join("router").join("server.js"));
    candidatos.into_iter().find(|p| p.is_file())
}

/// Pedido HTTP simples a 127.0.0.1 (HTTP/1.0: o servidor fecha ao terminar, sem resposta em pedaços).
fn http(metodo: &str, caminho: &str, token: &str, corpo: Option<&str>) -> Result<(u16, String), String> {
    let mut s = TcpStream::connect_timeout(&format!("127.0.0.1:{PORTA}").parse().unwrap(), Duration::from_millis(800)).map_err(|e| e.to_string())?;
    s.set_read_timeout(Some(Duration::from_secs(5))).ok();
    s.set_write_timeout(Some(Duration::from_secs(5))).ok();
    let corpo = corpo.unwrap_or("");
    let pedido = format!(
        "{metodo} {caminho} HTTP/1.0\r\nHost: 127.0.0.1:{PORTA}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{corpo}",
        corpo.len()
    );
    s.write_all(pedido.as_bytes()).map_err(|e| e.to_string())?;
    let mut bruto = Vec::new();
    s.read_to_end(&mut bruto).map_err(|e| e.to_string())?;
    let texto = String::from_utf8_lossy(&bruto).into_owned();
    let (cab, resto) = texto.split_once("\r\n\r\n").ok_or("resposta sem corpo")?;
    let status = cab.split_whitespace().nth(1).and_then(|c| c.parse().ok()).unwrap_or(0);
    Ok((status, resto.to_string()))
}

impl Roteador {
    fn vivo(&self) -> bool {
        let mut g = self.filho.lock().unwrap();
        match g.as_mut() {
            Some(f) => match f.try_wait() {
                Ok(None) => true,
                _ => {
                    *g = None;
                    false
                }
            },
            None => false,
        }
    }

    pub fn ligar(&self, dados: &Path) -> Result<(), String> {
        if self.vivo() {
            return Ok(());
        }
        let script = achar_script().ok_or("Não achei os arquivos do roteador (pasta router).")?;
        let token = token_novo();
        let mut c = Command::new("node");
        c.arg(&script)
            .env("ROUTER_TOKEN", &token)
            .env("ROUTER_PORT", PORTA.to_string())
            .env("ROUTER_DADOS", dados)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        c.creation_flags(0x0800_0000); // sem janela
        let filho = c.spawn().map_err(|_| "O roteador precisa do Node.js instalado (nodejs.org).".to_string())?;
        *self.filho.lock().unwrap() = Some(filho);
        *self.token.lock().unwrap() = token.clone();
        for _ in 0..40 {
            if http("GET", "/saude", &token, None).is_ok() {
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(150));
        }
        self.desligar();
        Err("O roteador não respondeu ao ligar.".into())
    }

    pub fn desligar(&self) {
        if let Some(mut f) = self.filho.lock().unwrap().take() {
            let _ = f.kill();
            let _ = f.wait();
        }
    }

    pub fn estado(&self) -> Value {
        let vazio = json!({ "endereco": format!("127.0.0.1:{PORTA}"), "ligado": false, "provedores": [], "cadeias": {}, "chamadas": [] });
        if !self.vivo() {
            return vazio;
        }
        let token = self.token.lock().unwrap().clone();
        match http("GET", "/painel/api/hypercube", &token, None) {
            Ok((200, corpo)) => serde_json::from_str(&corpo).unwrap_or(vazio),
            _ => vazio,
        }
    }

    pub fn salvar_cadeia(&self, nivel: &str, lista: &[String]) -> Result<(), String> {
        if !self.vivo() {
            return Err("O roteador está desligado.".into());
        }
        let token = self.token.lock().unwrap().clone();
        let corpo = json!({ "nivel": nivel, "lista": lista }).to_string();
        match http("PUT", "/painel/api/cadeia", &token, Some(&corpo))? {
            (200, _) => Ok(()),
            (_, t) => Err(t),
        }
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn token_tem_48_letras_e_muda() {
        let (a, b) = (token_novo(), token_novo());
        assert_eq!(a.len(), 48);
        assert_ne!(a, b);
    }

    #[test]
    fn acha_o_script_do_repositorio() {
        assert!(achar_script().is_some());
    }

    #[test]
    fn liga_responde_troca_cadeia_e_desliga() {
        if Command::new("node").arg("--version").output().is_err() {
            return; // sem Node nesta máquina
        }
        let dados = std::env::temp_dir().join(format!("hc-rot-{}", std::process::id()));
        let r = Roteador::default();
        r.ligar(&dados).expect("ligar");
        let e = r.estado();
        assert_eq!(e["ligado"], true);
        assert!(e["cadeias"]["barato"].as_array().unwrap().len() >= 2);
        r.salvar_cadeia("barato", &["gemini/padrao".to_string()]).expect("salvar");
        assert_eq!(r.estado()["cadeias"]["barato"][0], "gemini/padrao");
        assert!(r.salvar_cadeia("barato", &["inexistente/x".to_string()]).is_err());
        r.desligar();
        assert_eq!(r.estado()["ligado"], false);
        let _ = std::fs::remove_dir_all(&dados);
    }
}
