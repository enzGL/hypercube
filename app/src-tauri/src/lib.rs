//! Hypercube no Tauri 2: terminais (PTY), hooks do Claude Code, processos e sistema.
//! Os nomes dos comandos batem com app/src/nativo/tauri.ts.
mod fumaca;
mod hooks;
mod processos;
mod roteador;
mod saidas;
mod terminais;

use serde_json::Value;
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;

pub struct Estado {
    pub terminais: terminais::Terminais,
    pub hooks: hooks::ServidorHooks,
    pub roteador: roteador::Roteador,
}

type R<T> = Result<T, String>;

async fn em_fundo<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> R<T> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())
}

// ---------- terminais ----------

#[tauri::command]
async fn terminal_criar(app: AppHandle, estado: State<'_, Estado>, opcoes: terminais::OpcoesTerminal) -> R<String> {
    estado.terminais.criar(&app, &estado.hooks, opcoes)
}

#[tauri::command]
async fn terminal_escrever(estado: State<'_, Estado>, id: String, dados: String) -> R<()> {
    estado.terminais.escrever(&id, &dados)
}

#[tauri::command]
async fn terminal_redimensionar(estado: State<'_, Estado>, id: String, cols: u16, rows: u16) -> R<()> {
    estado.terminais.redimensionar(&id, cols, rows)
}

#[tauri::command]
async fn terminal_encerrar(estado: State<'_, Estado>, id: String) -> R<()> {
    estado.terminais.encerrar(&estado.hooks, &id)
}

#[tauri::command]
async fn terminal_historico(estado: State<'_, Estado>, id: String) -> R<String> {
    Ok(estado.terminais.historico(&id))
}

/// Texto e depois o Enter (para mandar mensagens ao agente).
#[tauri::command]
async fn terminal_enviar(estado: State<'_, Estado>, id: String, texto: String) -> R<()> {
    estado.terminais.enviar(&id, &texto)
}

#[tauri::command]
async fn terminal_resultado(estado: State<'_, Estado>, id: String) -> R<String> {
    Ok(estado.terminais.resultado(&estado.hooks, &id))
}

/// Milissegundos sem nada novo no terminal (`None` se ele não existe mais).
#[tauri::command]
async fn terminal_ocioso(estado: State<'_, Estado>, id: String) -> R<Option<u64>> {
    Ok(estado.terminais.ocioso_ms(&id))
}

// ---------- orquestrador (ferramentas do Líder) ----------

#[tauri::command]
async fn orquestrador_responder(estado: State<'_, Estado>, pedido: u64, texto: String, erro: bool) -> R<()> {
    hooks::responder_pedido(&estado.hooks.pedidos, pedido, if erro { Err(texto) } else { Ok(texto) });
    Ok(())
}

// ---------- teste de fumaça do Líder ----------

#[tauri::command]
async fn fumaca_lider() -> R<Option<serde_json::Value>> {
    Ok(fumaca::lider())
}

#[tauri::command]
async fn fumaca_registrar(linha: String) -> R<()> {
    fumaca::registrar(&linha);
    Ok(())
}

// ---------- processos ----------

#[tauri::command]
async fn processos_linhas_mudadas(worktree: String, pasta: String) -> R<(u64, u64)> {
    em_fundo(move || processos::linhas_mudadas(&worktree, &pasta)).await?
}

#[tauri::command]
async fn processos_resumo_mudancas(worktree: String, pasta: String) -> R<String> {
    em_fundo(move || processos::resumo_mudancas(&worktree, &pasta)).await?
}

#[tauri::command]
async fn processos_detectar_agentes() -> R<Vec<processos::AgenteDetectado>> {
    fumaca::interface_chamou("detectarAgentes()");
    em_fundo(processos::detectar_todos).await
}

#[tauri::command]
async fn processos_criar_worktree(pasta: String, ramo: String) -> R<String> {
    em_fundo(move || processos::criar_worktree(&pasta, &ramo)).await?
}

/// Uso do plano do Claude, lido da linha de status da última sessão aberta pelo app.
/// Vazio enquanto nenhuma sessão do Claude rodou. O Codex ainda não informa uso.
#[tauri::command]
async fn processos_uso_do_plano() -> R<Vec<hooks::UsoPlano>> {
    Ok(hooks::ULTIMO_USO.lock().unwrap().clone().into_iter().collect())
}

// ---------- sistema ----------

#[tauri::command]
async fn sistema_definir_titulo(janela: WebviewWindow, titulo: String) -> R<()> {
    fumaca::interface_chamou(&format!("definirTitulo({titulo:?})"));
    janela.set_title(&titulo).map_err(|e| e.to_string())
}

#[tauri::command]
async fn sistema_notificar(app: AppHandle, titulo: String, corpo: String) -> R<()> {
    app.notification().builder().title(titulo).body(corpo).show().map_err(|e| e.to_string())
}

/// A notificação do sistema já toca o som padrão; por ora não há som próprio.
#[tauri::command]
async fn sistema_tocar_som() -> R<()> {
    Ok(())
}

#[tauri::command]
async fn sistema_abrir_link(url: String) -> R<()> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Só abro links http(s)".into());
    }
    #[cfg(windows)]
    let r = {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &url])
            .creation_flags(0x0800_0000)
            .spawn()
    };
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(&url).spawn();
    r.map(|_| ()).map_err(|e| e.to_string())
}

/// Abre uma pasta no explorador de arquivos (só pastas que existem).
#[tauri::command]
async fn sistema_abrir_pasta(caminho: String) -> R<()> {
    let p = std::path::PathBuf::from(&caminho);
    if !p.is_dir() {
        return Err(format!("A pasta não existe: {caminho}"));
    }
    #[cfg(windows)]
    let r = std::process::Command::new("explorer.exe").arg(&p).spawn();
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(&p).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(&p).spawn();
    r.map(|_| ()).map_err(|e| e.to_string())
}

/// O servidor do canvas de imagens ainda não existe no Tauri.
#[tauri::command]
async fn sistema_porta_canvas() -> R<u16> {
    Ok(0)
}

// ---------- arquivos ----------

#[tauri::command]
async fn arquivos_escolher_pasta(app: AppHandle) -> R<Option<String>> {
    em_fundo(move || {
        app.dialog()
            .file()
            .set_title("Escolha a pasta do projeto")
            .blocking_pick_folder()
            .and_then(|p| p.into_path().ok())
            .map(|p| p.to_string_lossy().into_owned())
    })
    .await
}

#[tauri::command]
async fn arquivos_ler(caminho: String) -> R<String> {
    let p = std::path::PathBuf::from(&caminho);
    if !p.is_absolute() {
        return Err(format!("Caminho precisa ser completo: {caminho}"));
    }
    let meta = std::fs::metadata(&p).map_err(|e| e.to_string())?;
    if meta.len() > 5 * 1024 * 1024 {
        return Err("Arquivo grande demais (mais de 5 MB)".into());
    }
    std::fs::read_to_string(&p).map_err(|e| e.to_string())
}

/// Observa `<pasta>/.hypercube/saidas/` e emite `saidas:nova` para cada imagem, .svg ou .html.
#[tauri::command]
async fn arquivos_observar_saidas(app: AppHandle, pasta: String) -> R<()> {
    saidas::observar(app, &pasta);
    Ok(())
}

/// Salva uma tela (html/svg) ou copia uma imagem para o canvas da sessão (`.hypercube/saidas/`).
#[tauri::command]
async fn arquivos_salvar_saida(pasta: String, nome: String, texto: Option<String>, copiar_de: Option<String>) -> R<String> {
    em_fundo(move || saidas::salvar(&pasta, &nome, texto.as_deref(), copiar_de.as_deref())).await?
}

// ---------- roteador (modelos gratuitos para o nível barato) ----------

fn pasta_do_roteador(app: &AppHandle) -> R<std::path::PathBuf> {
    app.path().app_data_dir().map(|d| d.join("router")).map_err(|e| e.to_string())
}

#[tauri::command]
async fn roteador_estado(app: AppHandle) -> R<Value> {
    // A consulta é por socket e pode demorar um instante: fora da thread principal.
    em_fundo(move || app.state::<Estado>().roteador.estado()).await
}

#[tauri::command]
async fn roteador_ligar(app: AppHandle, ligado: bool) -> R<()> {
    let dados = pasta_do_roteador(&app)?;
    let marca = dados.join("ligado");
    if ligado {
        let (h, d) = (app.clone(), dados.clone());
        em_fundo(move || h.state::<Estado>().roteador.ligar(&d)).await??;
        let _ = std::fs::create_dir_all(&dados);
        let _ = std::fs::write(&marca, "1");
    } else {
        app.state::<Estado>().roteador.desligar();
        let _ = std::fs::remove_file(&marca);
    }
    Ok(())
}

/// Pedido de texto a um nível do roteador (usado pela ferramenta consulta_barata).
#[tauri::command]
async fn roteador_consultar(app: AppHandle, nivel: String, pedido: String) -> R<String> {
    em_fundo(move || app.state::<Estado>().roteador.consultar(&nivel, &pedido)).await?
}

#[tauri::command]
async fn roteador_salvar_cadeia(estado: State<'_, Estado>, nivel: String, provedores: Vec<String>) -> R<()> {
    estado.roteador.salvar_cadeia(&nivel, &provedores)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let hooks = hooks::iniciar(app.handle().clone())?;
            app.manage(Estado { terminais: terminais::Terminais::default(), hooks, roteador: roteador::Roteador::default() });
            // Se a pessoa deixou o roteador ligado da última vez, liga de novo em segundo plano.
            if let Ok(dados) = pasta_do_roteador(app.handle()) {
                if dados.join("ligado").exists() {
                    let h = app.handle().clone();
                    std::thread::spawn(move || {
                        if let Some(e) = h.try_state::<Estado>() {
                            let _ = e.roteador.ligar(&dados);
                        }
                    });
                }
            }
            if let Some(janela) = app.get_webview_window("main") {
                if fumaca::ligada() {
                    fumaca::posicionar_no_segundo_monitor(&janela);
                }
                let _ = janela.show();
            }
            if fumaca::ligada() {
                fumaca::rodar(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            terminal_criar,
            terminal_escrever,
            terminal_redimensionar,
            terminal_encerrar,
            terminal_historico,
            terminal_enviar,
            terminal_resultado,
            terminal_ocioso,
            orquestrador_responder,
            fumaca_lider,
            fumaca_registrar,
            processos_resumo_mudancas,
            processos_linhas_mudadas,
            processos_detectar_agentes,
            processos_criar_worktree,
            processos_uso_do_plano,
            sistema_definir_titulo,
            sistema_notificar,
            sistema_tocar_som,
            sistema_abrir_link,
            sistema_abrir_pasta,
            sistema_porta_canvas,
            arquivos_escolher_pasta,
            arquivos_ler,
            arquivos_observar_saidas,
            arquivos_salvar_saida,
            roteador_estado,
            roteador_ligar,
            roteador_salvar_cadeia,
            roteador_consultar,
        ])
        .build(tauri::generate_context!())
        .expect("erro ao iniciar o Hypercube");

    app.run(|app, ev| {
        if let tauri::RunEvent::Exit = ev {
            fumaca::registrar("evento: Exit");
            if let Some(e) = app.try_state::<Estado>() {
                e.terminais.encerrar_todos(&e.hooks);
                e.roteador.desligar();
            }
        }
    });
}
