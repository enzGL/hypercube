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

/// Nome seguro para um arquivo do canvas: sem pastas, sem caracteres estranhos, com a extensão certa.
fn nome_seguro(nome: &str, extensao: &str) -> Result<String, String> {
    let base = nome.trim().rsplit(['/', '\\']).next().unwrap_or("").trim();
    let sem_ext = match base.rsplit_once('.') {
        Some((a, e)) if e.eq_ignore_ascii_case(extensao) => a,
        _ => base,
    };
    let limpo: String = sem_ext
        .chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '-' | '_' | ' ') { c } else { '-' })
        .collect::<String>()
        .trim_matches(['-', ' '])
        .chars()
        .take(60)
        .collect();
    if limpo.is_empty() {
        return Err("Nome inválido para o arquivo do canvas.".into());
    }
    Ok(format!("{limpo}.{extensao}"))
}

/// Grava uma tela (html ou svg) ou copia uma imagem para `<pasta>/.hypercube/saidas/`. Devolve o caminho final.
/// `texto` é o conteúdo de html/svg; `copiar_de` é o arquivo de imagem a copiar.
pub fn salvar(pasta: &str, nome: &str, texto: Option<&str>, copiar_de: Option<&str>) -> Result<String, String> {
    let dir: PathBuf = Path::new(pasta).join(".hypercube").join("saidas");
    let (extensao, dados): (String, Vec<u8>) = match (texto, copiar_de) {
        (Some(t), None) => {
            let ext = if t.trim_start().starts_with("<svg") || t.trim_start().starts_with("<?xml") { "svg" } else { "html" };
            (ext.into(), t.as_bytes().to_vec())
        }
        (None, Some(origem)) => {
            let o = Path::new(origem);
            if !o.is_absolute() {
                return Err(format!("Passe o caminho completo da imagem: {origem}"));
            }
            let ext = o.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            if !matches!(tipo_do_arquivo(o), Some(("imagem", _))) {
                return Err("Só imagens png, jpg, gif ou webp (para html e svg, mande o texto).".into());
            }
            let meta = std::fs::metadata(o).map_err(|e| format!("Não achei a imagem: {e}"))?;
            if !meta.is_file() || meta.len() > LIMITE_BYTES {
                return Err("A imagem precisa ser um arquivo de até 8 MB.".into());
            }
            (ext, std::fs::read(o).map_err(|e| e.to_string())?)
        }
        _ => return Err("Falta o conteúdo.".into()),
    };
    if dados.len() as u64 > LIMITE_BYTES {
        return Err("Conteúdo grande demais (mais de 8 MB).".into());
    }
    let arquivo = nome_seguro(nome, &extensao)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let destino = dir.join(arquivo);
    std::fs::write(&destino, dados).map_err(|e| e.to_string())?;
    Ok(destino.to_string_lossy().into_owned())
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
    fn nome_seguro_tira_pastas_e_poe_extensao() {
        assert_eq!(nome_seguro("login", "html").unwrap(), "login.html");
        assert_eq!(nome_seguro("login.HTML", "html").unwrap(), "login.html");
        assert_eq!(nome_seguro("../../etc/passwd", "html").unwrap(), "passwd.html");
        assert_eq!(nome_seguro("a\\b\\tela 1", "svg").unwrap(), "tela 1.svg");
        assert_eq!(nome_seguro("a:b*c", "svg").unwrap(), "a-b-c.svg");
        assert!(nome_seguro("..", "html").is_err());
        assert!(nome_seguro("   ", "png").is_err());
    }

    #[test]
    fn salva_html_svg_e_copia_imagem_so_dentro_de_saidas() {
        let raiz = std::env::temp_dir().join(format!("hc-salvar-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&raiz);
        std::fs::create_dir_all(&raiz).unwrap();
        let pasta = raiz.to_string_lossy().into_owned();
        let h = salvar(&pasta, "../fora", Some("<b>oi</b>"), None).unwrap();
        assert!(h.ends_with("fora.html") && h.contains("saidas"));
        assert_eq!(std::fs::read_to_string(&h).unwrap(), "<b>oi</b>");
        let s = salvar(&pasta, "logo", Some("<svg xmlns=\"http://www.w3.org/2000/svg\"/>"), None).unwrap();
        assert!(s.ends_with("logo.svg"));
        let img = raiz.join("origem.png");
        std::fs::write(&img, [1u8, 2, 3]).unwrap();
        let c = salvar(&pasta, "foto", None, Some(&img.to_string_lossy())).unwrap();
        assert!(c.ends_with("foto.png"));
        assert!(salvar(&pasta, "x", None, Some("relativo.png")).is_err());
        let txt = raiz.join("segredo.txt");
        std::fs::write(&txt, "x").unwrap();
        assert!(salvar(&pasta, "x", None, Some(&txt.to_string_lossy())).is_err());
        assert!(salvar(&pasta, "x", None, None).is_err());
        let _ = std::fs::remove_dir_all(&raiz);
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
