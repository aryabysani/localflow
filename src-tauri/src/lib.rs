mod audio;
mod cleanup;
mod db;
mod hook;
mod inject;
mod pipeline;
mod whisper;

use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

use db::DbState;
use pipeline::PipelineState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_state = Arc::new(audio::AudioState::new());
    let pipeline_state = Arc::new(PipelineState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup({
            let audio_state = audio_state.clone();
            let pipeline_state = pipeline_state.clone();
            move |app| {
                // ── Database ────────────────────────────────────────────────
                let db_path = db::get_db_path(&app.handle()).expect("Failed to get DB path");
                let conn = rusqlite::Connection::open(&db_path)
                    .expect("Failed to open SQLite database");
                db::init_db(&conn).expect("Failed to initialize database");
                app.manage(DbState(std::sync::Mutex::new(conn)));

                // Initialize Windows low-level keyboard hook
                hook::init_hook(
                    app.handle().clone(),
                    audio_state.clone(),
                    pipeline_state.clone(),
                );

                // Show the bubble window on startup
                show_bubble_window(app.handle());

                // Intercept main window close to hide it instead of closing, keeping it in tray
                if let Some(main_win) = app.get_webview_window("main") {
                    let main_win_clone = main_win.clone();
                    main_win.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = main_win_clone.hide();
                        }
                    });
                }

                // ── Global shortcuts ────────────────────────────────────────
                if let Err(e) = register_global_toggle_shortcut(app.handle()) {
                    eprintln!("Failed to register initial global shortcut: {}", e);
                }

                // ── System Tray ─────────────────────────────────────────────
                let pipeline_tray = pipeline_state.clone();

                let open_item =
                    MenuItem::with_id(app, "open", "Open FlowLocal", true, None::<&str>)?;
                let privacy_item =
                    MenuItem::with_id(app, "privacy", "Privacy Mode: OFF", true, None::<&str>)?;
                let quit_item =
                    MenuItem::with_id(app, "quit", "Quit FlowLocal", true, None::<&str>)?;

                let menu = Menu::with_items(app, &[&open_item, &privacy_item, &quit_item])?;

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .on_menu_event(move |app, event| match event.id().as_ref() {
                        "open" => {
                            if let Some(win) = app.get_webview_window("main") {
                                win.show().ok();
                                win.set_focus().ok();
                            }
                        }
                        "privacy" => {
                            let mut mode = pipeline_tray.privacy_mode.lock().unwrap();
                            *mode = !*mode;
                            println!("Privacy mode: {}", *mode);
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(win) = app.get_webview_window("main") {
                                win.show().ok();
                                win.set_focus().ok();
                            }
                        }
                    })
                    .build(app)?;

                println!("FlowLocal initialized.");
                Ok(())
            }
        })
        .manage(audio_state.clone())
        .manage(pipeline_state.clone())
        .invoke_handler(tauri::generate_handler![
            // Audio
            audio::list_audio_devices,
            audio::start_audio_capture,
            audio::stop_audio_capture,
            audio::get_amplitude,
            audio::is_recording,
            // Whisper
            whisper::list_models,
            whisper::download_model,
            whisper::transcribe_audio,
            whisper::set_active_model,
            // Database
            db::save_dictation,
            db::get_history,
            db::delete_history_entry,
            db::clear_history,
            db::get_dashboard_stats,
            db::get_dictionary,
            db::add_dictionary_entry,
            db::delete_dictionary_entry,
            db::get_dictionary_prompt,
            db::get_setting,
            db::set_setting,
            db::get_all_settings,
            db::get_notes,
            db::save_note,
            db::delete_note,
            // Cleanup
            cleanup::cleanup_text,
            cleanup::command_mode_transform,
            // Inject
            inject::inject_text,
            inject::inject_text_clipboard,
            inject::get_foreground_app,
            // Pipeline
            pipeline::toggle_privacy_mode,
            pipeline::get_privacy_mode,
            pipeline::set_language,
            pipeline::get_pipeline_status,
            // Frontend-callable
            start_recording_cmd,
            stop_and_transcribe_cmd,
            get_system_stats,
            reload_global_shortcut,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FlowLocal");
}

/// Position and show the compact bubble window at the bottom right of the active monitor.
pub fn show_bubble_window(app: &tauri::AppHandle) {
    if let Some(b) = app.get_webview_window("bubble") {
        if let Ok(Some(monitor)) = b.current_monitor() {
            let monitor_size = monitor.size();
            let monitor_pos = monitor.position();
            let scale_factor = monitor.scale_factor();
            
            // Idle pill size: 56 × 36 logical pixels
            let bubble_width = (56.0 * scale_factor) as i32;
            let bubble_height = (36.0 * scale_factor) as i32;
            
            // ~1 cm margin from the bottom-right corner
            let margin = (40.0 * scale_factor) as i32;
            let x = monitor_pos.x + monitor_size.width as i32 - bubble_width - margin;
            let y = monitor_pos.y + monitor_size.height as i32 - bubble_height - margin;
            
            let _ = b.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: bubble_width as u32,
                height: bubble_height as u32,
            }));
            let _ = b.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }
        let _ = b.show();
        let _ = b.set_always_on_top(true);
    }
}

/// Run the STT pipeline after recording stops
pub async fn run_pipeline(
    app: &tauri::AppHandle,
    audio: &Arc<audio::AudioState>,
    pipeline: &Arc<PipelineState>,
) {
    use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

    *pipeline.is_processing.lock().unwrap() = true;
    app.emit("recording-stopped", ()).ok();
    app.emit("processing-started", ()).ok();

    let audio_data: Vec<f32> = {
        let mut buf = audio.buffer.lock().unwrap();
        if buf.is_empty() {
            *pipeline.is_processing.lock().unwrap() = false;
            app.emit("processing-done", serde_json::json!({"error": "No audio"})).ok();
            return;
        }
        buf.drain(..).collect()
    };

    let duration_secs = audio_data.len() as f64 / audio::SAMPLE_RATE as f64;
    let (app_name, app_exe) = inject::get_foreground_app();

    // Get dictionary prompt from DB
    let dict_prompt = {
        if let Some(db_state) = app.try_state::<DbState>() {
            let conn = db_state.0.lock().unwrap();
            let mut stmt = conn.prepare("SELECT term FROM dictionary ORDER BY term ASC").unwrap_or_else(|_| conn.prepare("SELECT 1 WHERE 0").unwrap());
            let terms: Vec<String> = stmt
                .query_map([], |row| row.get::<_, String>(0))
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
                .unwrap_or_default();
            if terms.is_empty() {
                String::new()
            } else {
                format!("Vocabulary: {}. ", terms.join(", "))
            }
        } else {
            String::new()
        }
    };

    let language = pipeline.current_language.lock().unwrap().clone();

    let model_path = match whisper::get_active_model_path(app) {
        Ok(p) => p,
        Err(e) => {
            *pipeline.is_processing.lock().unwrap() = false;
            app.emit("processing-done", serde_json::json!({"error": e})).ok();
            return;
        }
    };

    if !model_path.exists() {
        *pipeline.is_processing.lock().unwrap() = false;
        app.emit(
            "processing-done",
            serde_json::json!({"error": "Model not downloaded. Go to Models page."}),
        )
        .ok();
        return;
    }

    let model_str = model_path.to_str().unwrap_or("").to_string();
    let lang = language.clone();
    let prompt = dict_prompt.clone();

    let raw_text = tauri::async_runtime::spawn_blocking(move || {
        let ctx =
            WhisperContext::new_with_params(&model_str, WhisperContextParameters::default())
                .map_err(|e| format!("Whisper init: {}", e))?;
        let mut state = ctx
            .create_state()
            .map_err(|e| format!("Whisper state: {}", e))?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        if lang == "auto" {
            params.set_language(None);
        } else {
            params.set_language(Some(&lang));
        }
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_special(false);
        params.set_print_timestamps(false);
        if !prompt.is_empty() {
            params.set_initial_prompt(&prompt);
        }
        state.full(params, &audio_data).map_err(|e| e.to_string())?;
        let n = state.full_n_segments();
        let mut text = String::new();
        for i in 0..n {
            if let Some(segment) = state.get_segment(i) {
                if let Ok(seg) = segment.to_str() {
                    text.push_str(seg);
                }
            }
        }
        Ok::<String, String>(text.trim().to_string())
    })
    .await;

    let raw = match raw_text {
        Ok(Ok(t)) => t,
        Ok(Err(e)) => {
            let msg = format!("Transcription error: {}", e);
            eprintln!("{}", msg);
            *pipeline.is_processing.lock().unwrap() = false;
            app.emit("processing-done", serde_json::json!({"error": msg})).ok();
            return;
        }
        Err(e) => {
            let msg = format!("Task join error: {}", e);
            eprintln!("{}", msg);
            *pipeline.is_processing.lock().unwrap() = false;
            app.emit("processing-done", serde_json::json!({"error": msg})).ok();
            return;
        }
    };

    if raw.is_empty() {
        *pipeline.is_processing.lock().unwrap() = false;
        app.emit("processing-done", serde_json::json!({"error": "No speech detected"})).ok();
        return;
    }

    let cleaned = cleanup::regex_cleanup(&raw);

    let is_cmd = {
        let mut cmd = pipeline.is_command_mode.lock().unwrap();
        let was_cmd = *cmd;
        *cmd = false; // Reset command mode
        was_cmd
    };

    let text_to_inject = if is_cmd {
        let selected = {
            let mut txt = pipeline.command_mode_text.lock().unwrap();
            let val = txt.clone();
            *txt = String::new(); // Reset
            val
        };
        match cleanup::command_mode_transform(selected, cleaned.clone(), app_exe.clone()) {
            Ok(transformed) => transformed,
            Err(e) => {
                eprintln!("Command transform failed: {}", e);
                cleaned.clone()
            }
        }
    } else {
        cleaned.clone()
    };

    let word_count = text_to_inject.split_whitespace().count() as i64;

    // Save to DB
    let privacy = *pipeline.privacy_mode.lock().unwrap();
    if !privacy {
        if let Some(db_state) = app.try_state::<DbState>() {
            let conn = db_state.0.lock().unwrap();
            let track_apps: String = conn.query_row(
                "SELECT value FROM settings WHERE key = 'track_apps'",
                [],
                |row| row.get(0),
            ).unwrap_or_else(|_| "true".to_string());

            let (final_app_name, final_app_exe) = if track_apps == "false" {
                ("".to_string(), "".to_string())
            } else {
                (app_name.clone(), app_exe.clone())
            };

            let _ = conn.execute(
                "INSERT INTO dictation_history (app_name, app_exe, raw_text, cleaned_text, word_count, duration_secs, language) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![final_app_name, final_app_exe, raw, text_to_inject, word_count, duration_secs, language],
            );
        }
    }

    app.emit(
        "processing-done",
        serde_json::json!({
            "raw": raw,
            "cleaned": text_to_inject,
            "word_count": word_count,
            "app_name": app_name,
        }),
    )
    .ok();

    // Inject
    if let Err(e) = inject::inject_text_clipboard(text_to_inject).await {
        eprintln!("Injection failed: {}", e);
    }

    *pipeline.is_processing.lock().unwrap() = false;
    app.emit("recording-stopped", ()).ok();
}

/// Frontend button: start recording
#[tauri::command]
async fn start_recording_cmd(
    audio: tauri::State<'_, Arc<audio::AudioState>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if *audio.is_recording.lock().unwrap() {
        return Ok(());
    }
    let device = audio.device_name.lock().unwrap().clone();
    let dev_opt = if device.is_empty() { None } else { Some(device) };
    audio::start_capture_internal(audio.inner(), dev_opt)?;
    app.emit("recording-started", ()).ok();
    show_bubble_window(&app);
    Ok(())
}

/// Frontend button: stop recording and transcribe
#[tauri::command]
async fn stop_and_transcribe_cmd(
    audio: tauri::State<'_, Arc<audio::AudioState>>,
    pipeline: tauri::State<'_, Arc<PipelineState>>,
    _db: tauri::State<'_, DbState>,
    app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    audio::stop_capture_internal(audio.inner());

    let audio_arc = audio.inner().clone();
    let pipeline_arc = pipeline.inner().clone();
    run_pipeline(&app, &audio_arc, &pipeline_arc).await;

    Ok(serde_json::json!({"status": "done"}))
}

#[derive(Debug, serde::Serialize)]
pub struct SystemStats {
    pub process_cpu: f64,
    pub process_memory_mb: f64,
    pub system_cpu: f64,
    pub system_memory_pct: f64,
    pub estimated_power_watts: f64,
    pub app_state: String,
}

#[tauri::command]
async fn get_system_stats(
    audio: tauri::State<'_, Arc<audio::AudioState>>,
    pipeline: tauri::State<'_, Arc<pipeline::PipelineState>>,
) -> Result<SystemStats, String> {
    // 1. Get process memory info on Windows
    let memory_mb = {
        #[cfg(windows)]
        {
            use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
            use windows::Win32::System::Threading::GetCurrentProcess;
            unsafe {
                let handle = GetCurrentProcess();
                let mut counters = PROCESS_MEMORY_COUNTERS::default();
                if GetProcessMemoryInfo(
                    handle,
                    &mut counters,
                    std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
                ).is_ok() {
                    (counters.WorkingSetSize as f64) / 1024.0 / 1024.0
                } else {
                    0.0
                }
            }
        }
        #[cfg(not(windows))]
        {
            0.0
        }
    };

    // 2. Get system memory info
    let sys_memory_pct = {
        #[cfg(windows)]
        {
            use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
            unsafe {
                let mut status = MEMORYSTATUSEX::default();
                status.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
                if GlobalMemoryStatusEx(&mut status).is_ok() {
                    status.dwMemoryLoad as f64
                } else {
                    0.0
                }
            }
        }
        #[cfg(not(windows))]
        {
            0.0
        }
    };

    // 3. System CPU and process CPU delta calculation
    use once_cell::sync::Lazy;
    use std::sync::Mutex;
    use std::time::Instant;

    struct LastCpuSample {
        last_time: Instant,
        last_idle: u64,
        last_kernel: u64,
        last_user: u64,
        last_process_kernel: u64,
        last_process_user: u64,
        last_result_sys: f64,
        last_result_proc: f64,
    }

    static LAST_CPU: Lazy<Mutex<LastCpuSample>> = Lazy::new(|| {
        Mutex::new(LastCpuSample {
            last_time: Instant::now(),
            last_idle: 0,
            last_kernel: 0,
            last_user: 0,
            last_process_kernel: 0,
            last_process_user: 0,
            last_result_sys: 5.0,
            last_result_proc: 1.0,
        })
    });

    let mut cache = LAST_CPU.lock().unwrap();
    let now = Instant::now();
    let elapsed = now.duration_since(cache.last_time);

    if elapsed.as_millis() > 500 {
        #[cfg(windows)]
        {
            use windows::Win32::System::Threading::{GetSystemTimes, GetProcessTimes, GetCurrentProcess};
            use windows::Win32::Foundation::FILETIME;

            unsafe {
                let mut idle = FILETIME::default();
                let mut kernel = FILETIME::default();
                let mut user = FILETIME::default();

                let mut proc_creation = FILETIME::default();
                let mut proc_exit = FILETIME::default();
                let mut proc_kernel = FILETIME::default();
                let mut proc_user = FILETIME::default();

                let sys_ok = GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)).is_ok();
                let proc_ok = GetProcessTimes(
                    GetCurrentProcess(),
                    &mut proc_creation,
                    &mut proc_exit,
                    &mut proc_kernel,
                    &mut proc_user,
                ).is_ok();

                if sys_ok && proc_ok {
                    let to_u64 = |ft: FILETIME| -> u64 {
                        ((ft.dwHighDateTime as u64) << 32) | (ft.dwLowDateTime as u64)
                    };

                    let idle_val = to_u64(idle);
                    let kernel_val = to_u64(kernel);
                    let user_val = to_u64(user);

                    let proc_kernel_val = to_u64(proc_kernel);
                    let proc_user_val = to_u64(proc_user);

                    let idle_diff = idle_val.saturating_sub(cache.last_idle);
                    let kernel_diff = kernel_val.saturating_sub(cache.last_kernel);
                    let user_diff = user_val.saturating_sub(cache.last_user);

                    let proc_kernel_diff = proc_kernel_val.saturating_sub(cache.last_process_kernel);
                    let proc_user_diff = proc_user_val.saturating_sub(cache.last_process_user);

                    let total_sys = kernel_diff + user_diff;
                    if total_sys > 0 {
                        let sys_cpu = (1.0 - (idle_diff as f64 / total_sys as f64)) * 100.0;
                        cache.last_result_sys = sys_cpu.clamp(0.0, 100.0);

                        let proc_cpu = ((proc_kernel_diff + proc_user_diff) as f64 / total_sys as f64) * 100.0;
                        cache.last_result_proc = proc_cpu.clamp(0.0, 100.0);
                    }

                    cache.last_idle = idle_val;
                    cache.last_kernel = kernel_val;
                    cache.last_user = user_val;
                    cache.last_process_kernel = proc_kernel_val;
                    cache.last_process_user = proc_user_val;
                }
            }
        }
        cache.last_time = now;
    }

    let system_cpu = cache.last_result_sys;
    let process_cpu = cache.last_result_proc;

    // 4. App state & estimated power
    let is_rec = *audio.is_recording.lock().unwrap();
    let is_proc = *pipeline.is_processing.lock().unwrap();

    let (app_state, estimated_power_watts) = if is_proc {
        ("Transcribing".to_string(), 14.5)
    } else if is_rec {
        ("Recording".to_string(), 1.8)
    } else {
        ("Idle".to_string(), 0.1)
    };

    Ok(SystemStats {
        process_cpu,
        process_memory_mb: memory_mb,
        system_cpu,
        system_memory_pct: sys_memory_pct,
        estimated_power_watts,
        app_state,
    })
}

pub fn register_global_toggle_shortcut(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
    use std::str::FromStr;

    let global_sc = app.global_shortcut();
    
    // Unregister all first to clear previous toggle triggers
    let _ = global_sc.unregister_all();

    // Get the shortcut string from database
    let shortcut_str = if let Some(db_state) = app.try_state::<crate::db::DbState>() {
        let conn = db_state.0.lock().unwrap();
        conn.query_row(
            "SELECT value FROM settings WHERE key = 'shortcut_toggle'",
            [],
            |row| row.get::<_, String>(0)
        ).unwrap_or_else(|_| "Ctrl+Shift+Space".to_string())
    } else {
        "Ctrl+Shift+Space".to_string()
    };

    let shortcut = Shortcut::from_str(&shortcut_str)
        .or_else(|_| Shortcut::from_str("Ctrl+Shift+Space"))
        .map_err(|e| format!("Failed to parse global shortcut: {}", e))?;

    
    global_sc.on_shortcut(shortcut, move |app, _shortcut, _event| {
        let audio = app.state::<Arc<crate::audio::AudioState>>();
        let pipeline = app.state::<Arc<crate::pipeline::PipelineState>>();
        
        let is_rec = *audio.is_recording.lock().unwrap();
        let is_proc = *pipeline.is_processing.lock().unwrap();

        if is_proc {
            return;
        }

        if is_rec {
            let ah = app.clone();
            let audio_h = audio.inner().clone();
            let pipeline_h = pipeline.inner().clone();
            tauri::async_runtime::spawn(async move {
                crate::audio::stop_capture_internal(&audio_h);
                crate::run_pipeline(&ah, &audio_h, &pipeline_h).await;
            });
        } else {
            let device = audio.device_name.lock().unwrap().clone();
            let dev_opt = if device.is_empty() { None } else { Some(device) };
            if let Err(e) = crate::audio::start_capture_internal(audio.inner(), dev_opt) {
                eprintln!("Global Shortcut: failed to start recording: {}", e);
                return;
            }
            app.emit("recording-started", ()).ok();
            crate::show_bubble_window(app);
        }
    }).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn reload_global_shortcut(app: tauri::AppHandle) -> Result<(), String> {
    register_global_toggle_shortcut(&app)
}
