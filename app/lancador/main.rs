//! Lançador do Hypercube enquanto o app ainda não roda dentro do Tauri 2.
//!
//! Serve a interface compilada (dist/) só em 127.0.0.1 e abre numa janela
//! própria do Edge ou do Chrome (modo app, sem barra de endereço).
//!
//!   hypercube                      abre o Hypercube
//!   hypercube --exemplo            abre direto com a sessão de exemplo
//!   hypercube --screenshot f.png   desenha a tela, salva a imagem e sai
//!
//! Com --screenshot o navegador roda sem janela (headless): não rouba o foco,
//! não aparece na frente de nada e continua desenhando mesmo sem foco.
#![windows_subsystem = "windows"]

use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const PORTA_PREFERIDA: u16 = 47630;

fn achar_dist() -> Option<PathBuf> {
    let mut lugares: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        let mut p = exe.parent().map(Path::to_path_buf);
        for _ in 0..5 {
            if let Some(d) = p {
                lugares.push(d.join("dist"));
                p = d.parent().map(Path::to_path_buf);
            } else {
                break;
            }
        }
    }
    if let Ok(atual) = std::env::current_dir() {
        lugares.push(atual.join("dist"));
    }
    lugares.into_iter().find(|d| d.join("index.html").is_file())
}

fn tipo(caminho: &Path) -> &'static str {
    match caminho.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "json" => "application/json",
        _ => "application/octet-stream",
    }
}

fn decodificar(s: &str) -> String {
    let b = s.as_bytes();
    let mut saida = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                saida.push(v);
                i += 3;
                continue;
            }
        }
        saida.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&saida).into_owned()
}

fn atender(mut conexao: TcpStream, raiz: &Path) {
    let mut leitor = BufReader::new(match conexao.try_clone() {
        Ok(c) => c,
        Err(_) => return,
    });
    let mut linha = String::new();
    if leitor.read_line(&mut linha).is_err() {
        return;
    }
    // Descarta os cabeçalhos.
    let mut cab = String::new();
    while leitor.read_line(&mut cab).map(|n| n > 2).unwrap_or(false) {
        cab.clear();
    }
    let alvo = linha.split_whitespace().nth(1).unwrap_or("/");
    let alvo = alvo.split(['?', '#']).next().unwrap_or("/");
    let alvo = decodificar(alvo);
    let relativo = alvo.trim_start_matches('/');
    let relativo = if relativo.is_empty() { "index.html" } else { relativo };
    let seguro = !relativo.split(['/', '\\']).any(|p| p == "..");
    let arquivo = raiz.join(relativo);
    let resposta = if seguro && arquivo.is_file() {
        fs::read(&arquivo).ok().map(|corpo| (200, tipo(&arquivo), corpo))
    } else {
        None
    };
    let (codigo, ctipo, corpo) = resposta.unwrap_or((404, "text/plain; charset=utf-8", b"nao encontrado".to_vec()));
    let status = if codigo == 200 { "200 OK" } else { "404 Not Found" };
    let _ = write!(
        conexao,
        "HTTP/1.1 {status}\r\nContent-Type: {ctipo}\r\nContent-Length: {}\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
        corpo.len()
    );
    let _ = conexao.write_all(&corpo);
}

fn servir(raiz: PathBuf) -> std::io::Result<u16> {
    let ouvinte = TcpListener::bind(("127.0.0.1", PORTA_PREFERIDA)).or_else(|_| TcpListener::bind(("127.0.0.1", 0)))?;
    let porta = ouvinte.local_addr()?.port();
    thread::spawn(move || {
        for conexao in ouvinte.incoming().flatten() {
            let raiz = raiz.clone();
            thread::spawn(move || atender(conexao, &raiz));
        }
    });
    Ok(porta)
}

fn achar_navegador() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("HYPERCUBE_NAVEGADOR") {
        let p = PathBuf::from(p);
        if p.is_file() {
            return Some(p);
        }
    }
    let mut candidatos: Vec<PathBuf> = Vec::new();
    if cfg!(windows) {
        for var in ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"] {
            if let Ok(base) = std::env::var(var) {
                candidatos.push(Path::new(&base).join("Microsoft/Edge/Application/msedge.exe"));
                candidatos.push(Path::new(&base).join("Google/Chrome/Application/chrome.exe"));
            }
        }
    } else if cfg!(target_os = "macos") {
        candidatos.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into());
        candidatos.push("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge".into());
        candidatos.push("/Applications/Chromium.app/Contents/MacOS/Chromium".into());
    } else {
        for n in ["microsoft-edge", "google-chrome", "chromium", "chromium-browser"] {
            for d in ["/usr/bin", "/usr/local/bin", "/snap/bin"] {
                candidatos.push(Path::new(d).join(n));
            }
        }
    }
    candidatos.into_iter().find(|c| c.is_file())
}

fn tirar_foto(navegador: &Path, url: &str, arquivo: &Path) -> ExitCode {
    if let Some(pai) = arquivo.parent() {
        let _ = fs::create_dir_all(pai);
    }
    let _ = fs::remove_file(arquivo);
    let perfil = std::env::temp_dir().join(format!("hypercube-foto-{}", std::process::id()));
    let filho = Command::new(navegador)
        .args([
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--no-default-browser-check",
            "--mute-audio",
            "--window-size=1440,900",
            // ~120 quadros a 60 por segundo antes da foto
            "--virtual-time-budget=2000",
        ])
        .arg(format!("--user-data-dir={}", perfil.display()))
        .arg(format!("--screenshot={}", arquivo.display()))
        .arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    let mut filho = match filho {
        Ok(f) => f,
        Err(_) => return ExitCode::FAILURE,
    };
    let inicio = Instant::now();
    loop {
        match filho.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if inicio.elapsed() < Duration::from_secs(120) => thread::sleep(Duration::from_millis(100)),
            _ => {
                let _ = filho.kill();
                break;
            }
        }
    }
    let _ = fs::remove_dir_all(&perfil);
    match fs::metadata(arquivo) {
        Ok(m) if m.len() > 0 => ExitCode::SUCCESS,
        _ => ExitCode::FAILURE,
    }
}

fn abrir_janela(navegador: Option<PathBuf>, url: &str) -> ExitCode {
    let Some(navegador) = navegador else {
        // Sem Edge/Chrome: abre no navegador padrão e continua servindo.
        #[cfg(windows)]
        let _ = Command::new("cmd").args(["/C", "start", "", url]).spawn();
        #[cfg(target_os = "macos")]
        let _ = Command::new("open").arg(url).spawn();
        #[cfg(all(unix, not(target_os = "macos")))]
        let _ = Command::new("xdg-open").arg(url).spawn();
        loop {
            thread::sleep(Duration::from_secs(3600));
        }
    };
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("HOME").map(|h| Path::new(&h).join(".local/share")))
        .unwrap_or_else(|_| std::env::temp_dir());
    let perfil = base.join("Hypercube").join("janela");
    let _ = fs::create_dir_all(&perfil);
    let filho = Command::new(navegador)
        .arg(format!("--app={url}"))
        .arg(format!("--user-data-dir={}", perfil.display()))
        .args(["--window-size=1440,900", "--no-first-run", "--no-default-browser-check"])
        .spawn();
    match filho {
        Ok(mut f) => {
            let _ = f.wait();
            ExitCode::SUCCESS
        }
        Err(_) => ExitCode::FAILURE,
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut foto: Option<PathBuf> = None;
    let mut exemplo = false;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--screenshot" => {
                foto = args.get(i + 1).map(PathBuf::from);
                i += 1;
            }
            a if a.starts_with("--screenshot=") => foto = Some(PathBuf::from(&a["--screenshot=".len()..])),
            "--exemplo" => exemplo = true,
            _ => {}
        }
        i += 1;
    }

    let Some(dist) = achar_dist() else {
        eprintln!("A interface ainda não foi compilada: rode `npm run build`.");
        return ExitCode::FAILURE;
    };
    let porta = match servir(dist) {
        Ok(p) => p,
        Err(_) => return ExitCode::FAILURE,
    };
    let mut url = format!("http://127.0.0.1:{porta}/");
    if exemplo {
        url.push_str("?exemplo");
    }
    let navegador = achar_navegador();
    match foto {
        Some(arquivo) => {
            let arquivo = if arquivo.is_absolute() {
                arquivo
            } else {
                std::env::current_dir().map(|d| d.join(&arquivo)).unwrap_or(arquivo)
            };
            match navegador {
                Some(n) => tirar_foto(&n, &url, &arquivo),
                None => ExitCode::FAILURE,
            }
        }
        None => abrir_janela(navegador, &url),
    }
}
