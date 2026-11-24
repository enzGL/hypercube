//! Canvas de imagens: observa `<pasta>/.hypercube/saidas/` e avisa a interface de cada imagem, .svg ou .html
//! que aparece ou muda. Sem dependência extra: confere a pasta a cada segundo.
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const LIMITE_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaidaGerada {
    pub id: String,
    pub tipo: &'static str,
    pub nome: String,
    pub caminho: String,
    pub conteudo: String,
    pub criado_em: u64,
}

fn vigias() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static V: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
    V.get_or_init(|| Mutex::new(HashMap::new()))
}

fn base64(dados: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::with_capacity(dados.len().div_ceil(3) * 4);
    for bloco in dados.chunks(3) {
        let b = [bloco[0], *bloco.get(1).unwrap_or(&0), *bloco.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        s.push(T[(n >> 18) as usize & 63] as char);
        s.push(T[(n >> 12) as usize & 63] as char);
        s.push(if bloco.len() > 1 { T[(n >> 6) as usize & 63] as char } else { '=' });
        s.push(if bloco.len() > 2 { T[n as usize & 63] as char } else { '=' });
    }
    s
}

/// (tipo, tipo MIME) de um arquivo que o canvas sabe mostrar.
fn tipo_do_arquivo(caminho: &Path) -> Option<(&'static str, &'static str)> {
    let ext = caminho.extension()?.to_str()?.to_lowercase();
    Some(match ext.as_str() {
        "png" => ("imagem", "image/png"),
        "jpg" | "jpeg" => ("imagem", "image/jpeg"),
        "gif" => ("imagem", "image/gif"),
        "webp" => ("imagem", "image/webp"),
        "svg" => ("svg", "image/svg+xml"),
        "html" | "htm" => ("html", "text/html"),
        _ => return None,
    })
}

fn ler_saida(caminho: &Path, mtime: SystemTime) -> Option<SaidaGerada> {
    let (tipo, mime) = tipo_do_arquivo(caminho)?;
    let meta = std::fs::metadata(caminho).ok()?;
    if !meta.is_file() || meta.len() > LIMITE_BYTES {
        return None;
    }
    let bytes = std::fs::read(caminho).ok()?;
    let conteudo = if tipo == "html" {
        String::from_utf8_lossy(&bytes).into_owned()
    } else {
        format!("data:{mime};base64,{}", base64(&bytes))
    };
    let ms = mtime.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
    let caminho_txt = caminho.to_string_lossy().into_owned();
    Some(SaidaGerada {
        // O id muda quando o arquivo é reescrito, para a interface mostrar a versão nova.
        id: format!("{caminho_txt}@{ms}"),
        tipo,
        nome: caminho.file_name()?.to_string_lossy().into_owned(),
        caminho: caminho_txt,
        conteudo,
        criado_em: ms,
    })
}

/// Começa a observar a pasta de saídas desta sessão (substitui uma observação anterior da mesma pasta).
pub fn observar(app: AppHandle, pasta: &str) {
    let dir: PathBuf = Path::new(pasta).join(".hypercube").join("saidas");
    let chave = dir.to_string_lossy().into_owned();
    let parar = Arc::new(AtomicBool::new(false));
    if let Some(antigo) = vigias().lock().unwrap().insert(chave.clone(), parar.clone()) {
        antigo.store(true, Ordering::Relaxed);
    }
    let _ = std::fs::create_dir_all(&dir);
    std::thread::spawn(move || {
        let mut vistos: HashSet<(PathBuf, SystemTime)> = HashSet::new();
        while !parar.load(Ordering::Relaxed) {
            if let Ok(lista) = std::fs::read_dir(&dir) {
                let mut novos: Vec<(SystemTime, PathBuf)> = Vec::new();
                for entrada in lista.flatten() {
                    let caminho = entrada.path();
                    let Ok(mtime) = entrada.metadata().and_then(|m| m.modified()) else { continue };
                    if tipo_do_arquivo(&caminho).is_some() && !vistos.contains(&(caminho.clone(), mtime)) {
                        novos.push((mtime, caminho));
                    }
                }
                novos.sort();
                for (mtime, caminho) in novos {
                    // Arquivo ainda sendo escrito: espera a próxima volta.
                    if mtime.elapsed().map(|e| e < Duration::from_millis(400)).unwrap_or(false) {
                        continue;
                    }
                    vistos.insert((caminho.clone(), mtime));
                    if let Some(s) = ler_saida(&caminho, mtime) {
                        let _ = app.emit("saidas:nova", s);
                    }
                }
            }
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn base64_confere_com_o_padrao() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"hello!"), "aGVsbG8h");
    }

    #[test]
    fn so_aceita_imagem_svg_e_html() {
        assert_eq!(tipo_do_arquivo(Path::new("a/b.PNG")).map(|t| t.0), Some("imagem"));
        assert_eq!(tipo_do_arquivo(Path::new("a/b.svg")).map(|t| t.0), Some("svg"));
        assert_eq!(tipo_do_arquivo(Path::new("a/b.html")).map(|t| t.0), Some("html"));
        assert!(tipo_do_arquivo(Path::new("a/b.exe")).is_none());
        assert!(tipo_do_arquivo(Path::new("a/semextensao")).is_none());
    }

    #[test]
    fn le_uma_saida_html_e_uma_imagem() {
        let dir = std::env::temp_dir().join(format!("hc-saidas-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let h = dir.join("a.html");
        std::fs::write(&h, "<b>oi</b>").unwrap();
        let s = ler_saida(&h, SystemTime::now()).unwrap();
        assert_eq!((s.tipo, s.conteudo.as_str(), s.nome.as_str()), ("html", "<b>oi</b>", "a.html"));
        let p = dir.join("b.png");
        std::fs::write(&p, [1u8, 2, 3]).unwrap();
        let s = ler_saida(&p, SystemTime::now()).unwrap();
        assert_eq!((s.tipo, s.conteudo.as_str()), ("imagem", "data:image/png;base64,AQID"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
