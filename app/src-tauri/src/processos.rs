//! Achar programas no PATH, detectar agentes instalados e criar worktrees.
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const SEM_JANELA: u32 = 0x0800_0000; // CREATE_NO_WINDOW

/// Procura um programa no PATH (no Windows, também com as extensões do PATHEXT).
pub fn resolver(nome: &str) -> Option<PathBuf> {
    let caminhos = std::env::var_os("PATH")?;
    #[cfg(windows)]
    let exts: Vec<String> = std::env::var("PATHEXT")
        .unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".into())
        .split(';')
        .filter(|e| !e.is_empty())
        .map(|e| e.to_ascii_lowercase())
        .collect();
    for dir in std::env::split_paths(&caminhos) {
        #[cfg(windows)]
        for ext in &exts {
            let p = dir.join(format!("{nome}{ext}"));
            if p.is_file() {
                return Some(p);
            }
        }
        #[cfg(not(windows))]
        {
            let p = dir.join(nome);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

/// No Windows, .cmd/.bat precisam passar pelo cmd.exe.
pub fn precisa_cmd(p: &Path) -> bool {
    cfg!(windows)
        && p.extension()
            .map(|e| {
                let e = e.to_string_lossy().to_ascii_lowercase();
                e == "cmd" || e == "bat"
            })
            .unwrap_or(false)
}

fn comando_sem_janela(prog: &Path, args: &[&str]) -> Command {
    let mut c = if precisa_cmd(prog) {
        let mut c = Command::new("cmd.exe");
        c.arg("/d").arg("/c").arg(prog).args(args);
        c
    } else {
        let mut c = Command::new(prog);
        c.args(args);
        c
    };
    #[cfg(windows)]
    c.creation_flags(SEM_JANELA);
    c
}

/// Roda e espera no máximo `limite`; devolve (sucesso, stdout).
fn rodar_com_limite(mut c: Command, limite: Duration) -> Option<(bool, String)> {
    c.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
    let mut filho = c.spawn().ok()?;
    let mut saida = filho.stdout.take()?;
    let leitor = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = std::io::Read::read_to_string(&mut saida, &mut s);
        s
    });
    let inicio = Instant::now();
    loop {
        match filho.try_wait() {
            Ok(Some(st)) => return Some((st.success(), leitor.join().unwrap_or_default())),
            Ok(None) if inicio.elapsed() < limite => std::thread::sleep(Duration::from_millis(50)),
            _ => {
                let _ = filho.kill();
                let _ = filho.wait();
                return None;
            }
        }
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct AgenteDetectado {
    pub agente: String,
    pub instalado: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub versao: Option<String>,
    pub comando: String,
}

pub const AGENTES: [&str; 5] = ["claude", "codex", "gemini", "kiro", "opencode"];

/// "codex-cli 0.169.0" → "0.169.0"; "2.1.322 (Claude Code)" → "2.1.322". Sem número, a linha curta.
pub fn numero_da_versao(linha: &str) -> String {
    linha
        .split(|c: char| c.is_whitespace() || c == '(' || c == ')' || c == ',')
        .map(|p| p.trim_start_matches('v'))
        .find(|p| p.contains('.') && p.chars().next().is_some_and(|c| c.is_ascii_digit()))
        .map(str::to_string)
        .unwrap_or_else(|| linha.chars().take(24).collect())
}

pub fn detectar_um(agente: &str) -> AgenteDetectado {
    let mut r = AgenteDetectado { agente: agente.into(), instalado: false, versao: None, comando: agente.into() };
    let Some(prog) = resolver(agente) else { return r };
    r.instalado = true;
    if let Some((_, out)) = rodar_com_limite(comando_sem_janela(&prog, &["--version"]), Duration::from_secs(8)) {
        let linha = out.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("");
        if !linha.is_empty() {
            r.versao = Some(numero_da_versao(linha));
        }
    }
    r
}

pub fn detectar_todos() -> Vec<AgenteDetectado> {
    let fios: Vec<_> = AGENTES.iter().map(|a| std::thread::spawn(move || detectar_um(a))).collect();
    fios.into_iter()
        .zip(AGENTES)
        .map(|(f, a)| f.join().unwrap_or_else(|_| AgenteDetectado { agente: a.into(), instalado: false, versao: None, comando: a.into() }))
        .collect()
}

fn ramo_seguro(ramo: &str) -> String {
    let s: String = ramo
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c.to_ascii_lowercase() } else { '-' })
        .collect();
    let s = s.trim_matches('-').to_string();
    if s.is_empty() { "vertice".into() } else { s }
}

/// Modelo do Codex para quando o do config.toml não vale para a conta: o primeiro da lista
/// de modelos que o próprio Codex guardou (models_cache.json). `None` = o do config serve.
pub fn modelo_codex_reserva() -> Option<String> {
    let casa = PathBuf::from(std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })?).join(".codex");
    let cache: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(casa.join("models_cache.json")).ok()?).ok()?;
    let lista = cache.get("models").and_then(|m| m.as_array())?;
    let slug = |m: &serde_json::Value| m.get("slug").and_then(|s| s.as_str()).map(str::to_string);
    let todos: Vec<String> = lista.iter().filter_map(slug).collect();
    let configurado = std::fs::read_to_string(casa.join("config.toml")).ok().and_then(|t| {
        t.lines()
            .take_while(|l| !l.trim_start().starts_with('['))
            .find_map(|l| l.trim().strip_prefix("model").map(str::trim).and_then(|r| r.strip_prefix('=')).map(|r| r.trim().trim_matches('"').to_string()))
    });
    match configurado {
        Some(m) if !todos.contains(&m) => lista
            .iter()
            .find(|m| m.get("visibility").and_then(|v| v.as_str()) == Some("list"))
            .and_then(slug),
        _ => None,
    }
}

fn git_saida(git: &Path, pasta: &Path, args: &[&str]) -> String {
    let mut c = comando_sem_janela(git, args);
    c.current_dir(pasta);
    rodar_com_limite(c, Duration::from_secs(15)).map(|(_, s)| s).unwrap_or_default()
}

/// O que mudou na cópia (worktree) de um agente desde que ela saiu do projeto: branch,
/// commits, arquivos e o diff (cortado).
pub fn resumo_mudancas(worktree: &str, pasta: &str) -> Result<String, String> {
    let wt = PathBuf::from(worktree);
    if !wt.is_dir() {
        return Err(format!("Pasta não encontrada: {worktree}"));
    }
    let git = resolver("git").ok_or("git não encontrado no PATH")?;
    let ramo = git_saida(&git, &wt, &["rev-parse", "--abbrev-ref", "HEAD"]).trim().to_string();
    let topo_projeto = git_saida(&git, Path::new(pasta), &["rev-parse", "HEAD"]).trim().to_string();
    let base = if topo_projeto.is_empty() {
        String::new()
    } else {
        git_saida(&git, &wt, &["merge-base", "HEAD", &topo_projeto]).trim().to_string()
    };
    let base = if base.is_empty() { "HEAD".to_string() } else { base };
    let commits = git_saida(&git, &wt, &["log", "--oneline", "-15", &format!("{base}..HEAD")]);
    let estado = git_saida(&git, &wt, &["status", "--short"]);
    let arquivos = git_saida(&git, &wt, &["diff", "--stat", &base]);
    let mut diff = git_saida(&git, &wt, &["diff", &base]);
    if diff.len() > 6000 {
        let mut c = 6000;
        while !diff.is_char_boundary(c) {
            c -= 1;
        }
        diff.truncate(c);
        diff.push_str("\n… (diff cortado)");
    }
    let ou = |s: &str, nada: &str| if s.trim().is_empty() { nada.to_string() } else { s.trim_end().to_string() };
    Ok(format!(
        "Pasta: {worktree}\nBranch: {ramo}\nCommits novos:\n{}\nArquivos sem commit:\n{}\nArquivos mudados desde a base:\n{}\nDiff:\n{}",
        ou(&commits, "(nenhum)"),
        ou(&estado, "(nenhum)"),
        ou(&arquivos, "(nenhum)"),
        ou(&diff, "(vazio)")
    ))
}

/// Soma das linhas acrescentadas e removidas na cópia (worktree) desde que saiu do projeto,
/// contando commits e mudanças ainda sem commit nos arquivos já conhecidos pelo git.
pub fn linhas_mudadas(worktree: &str, pasta: &str) -> Result<(u64, u64), String> {
    let wt = PathBuf::from(worktree);
    if !wt.is_dir() {
        return Err(format!("Pasta não encontrada: {worktree}"));
    }
    let git = resolver("git").ok_or("git não encontrado no PATH")?;
    let topo = git_saida(&git, Path::new(pasta), &["rev-parse", "HEAD"]).trim().to_string();
    let base = if topo.is_empty() { String::new() } else { git_saida(&git, &wt, &["merge-base", "HEAD", &topo]).trim().to_string() };
    let base = if base.is_empty() { "HEAD".to_string() } else { base };
    Ok(somar_numstat(&git_saida(&git, &wt, &["diff", "--numstat", &base])))
}

/// Soma a saída de `git diff --numstat` (arquivos binários aparecem com "-" e não contam).
pub fn somar_numstat(texto: &str) -> (u64, u64) {
    texto.lines().fold((0, 0), |(m, n), l| {
        let mut p = l.split_whitespace();
        let (a, b) = (p.next().and_then(|x| x.parse::<u64>().ok()), p.next().and_then(|x| x.parse::<u64>().ok()));
        (m + a.unwrap_or(0), n + b.unwrap_or(0))
    })
}

/// `git worktree add` numa pasta irmã: <pasta>-wt-<ramo>, branch v/<ramo>.
pub fn criar_worktree(pasta: &str, ramo: &str) -> Result<String, String> {
    let base = PathBuf::from(pasta);
    if !base.is_dir() {
        return Err(format!("Pasta não encontrada: {pasta}"));
    }
    let ramo = ramo_seguro(ramo);
    let nome = base.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "projeto".into());
    let pai = base.parent().unwrap_or(&base);
    let mut destino = pai.join(format!("{nome}-wt-{ramo}"));
    let mut n = 2;
    while destino.exists() {
        destino = pai.join(format!("{nome}-wt-{ramo}-{n}"));
        n += 1;
    }
    let git = resolver("git").ok_or("git não encontrado no PATH")?;
    let branch = format!("v/{ramo}");
    let existe = rodar_com_limite(
        {
            let mut c = comando_sem_janela(&git, &["rev-parse", "--verify", "--quiet", &format!("refs/heads/{branch}")]);
            c.current_dir(&base);
            c
        },
        Duration::from_secs(10),
    )
    .map(|(ok, _)| ok)
    .unwrap_or(false);
    let dest = destino.to_string_lossy().to_string();
    let args: Vec<&str> = if existe {
        vec!["worktree", "add", &dest, &branch]
    } else {
        vec!["worktree", "add", "-b", &branch, &dest]
    };
    let mut c = comando_sem_janela(&git, &args);
    c.current_dir(&base).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::piped());
    let out = c.output().map_err(|e| format!("Não consegui rodar o git: {e}"))?;
    if !out.status.success() {
        return Err(format!("git worktree falhou: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(dest)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn soma_numstat() {
        assert_eq!(somar_numstat("6	1	preco.js
19	0	preco.test.js
-	-	img.png
"), (25, 1));
        assert_eq!(somar_numstat(""), (0, 0));
    }

    #[test]
    fn cria_worktree_num_repo_temporario() {
        let raiz = std::env::temp_dir().join(format!("hypercube-teste-wt-{}", std::process::id()));
        let repo = raiz.join("proj");
        std::fs::create_dir_all(&repo).unwrap();
        let git = |args: &[&str]| {
            assert!(Command::new("git").args(args).current_dir(&repo).output().unwrap().status.success(), "{args:?}");
        };
        git(&["init", "-q"]);
        git(&["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "x"]);
        let wt = criar_worktree(repo.to_str().unwrap(), "Construtor 1").unwrap();
        assert!(wt.ends_with("proj-wt-construtor-1"));
        assert!(PathBuf::from(&wt).join(".git").exists());
        let _ = std::fs::remove_dir_all(&raiz);
    }
}
