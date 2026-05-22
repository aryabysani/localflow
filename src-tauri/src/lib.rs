mod audio;
mod cleanup;
mod db;
mod inject;
mod pipeline;
mod whisper;

use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

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

                // ── Global shortcuts ────────────────────────────────────────
                let app_handle = app.handle().clone();
                let audio_for_sc = audio_state.clone();
                let pipeline_for_sc = pipeline_state.clone();

                // Ctrl+Shift+Space — toggle recording
                let shortcut_toggle =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);

                {
                    let ah = app_handle.clone();
                    let audio_h = audio_for_sc.clone();
                    let pipeline_h = pipeline_for_sc.clone();

                    app.global_shortcut().on_shortcut(
                        shortcut_toggle,
                        move |_app, _shortcut, _event| {
                            let is_rec = *audio_h.is_recording.lock().unwrap();
                            let is_proc = *pipeline_h.is_processing.lock().unwrap();

                            if is_proc {
                                return;
                            }

                            if is_rec {
                                let ah2 = ah.clone();
                                let audio2 = audio_h.clone();
                                let pipeline2 = pipeline_h.clone();
                                tauri::async_runtime::spawn(async move {
                                    // Hide bubble
                                    if let Some(b) = ah2.get_webview_window("bubble") {
                                        b.hide().ok();
                                    }
                                    // Stop stream inline
                                    {
                                        *audio2.stream.lock().unwrap() = None;
                                        *audio2.is_recording.lock().unwrap() = false;
                                    }
                                    // Run pipeline inline
                                    run_pipeline(&ah2, &audio2, &pipeline2).await;
                                });
                            } else {
                                // Start recording
                                let device = audio_h.device_name.lock().unwrap().clone();
                                let dev_opt = if device.is_empty() { None } else { Some(device) };
                                if let Err(e) = audio::start_capture_internal(&audio_h, dev_opt) {
                                    eprintln!("Failed to start recording: {}", e);
                                    return;
                                }
                                ah.emit("recording-started", ()).ok();
                                // Show bubble
                                if let Some(b) = ah.get_webview_window("bubble") {
                                    b.show().ok();
                                }
                            }
                        },
                    )?;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running FlowLocal");
}

/// Run the STT pipeline after recording stops
async fn run_pipeline(
    app: &tauri::AppHandle,
    audio: &Arc<audio::AudioState>,
    pipeline: &Arc<PipelineState>,
) {
    use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

    *pipeline.is_processing.lock().unwrap() = true;
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
        let n = state.full_n_segments().map_err(|e| e.to_string())?;
        let mut text = String::new();
        for i in 0..n {
            if let Ok(seg) = state.full_get_segment_text(i) {
                text.push_str(&seg);
            }
        }
        Ok::<String, String>(text.trim().to_string())
    })
    .await;

    let raw = match raw_text {
        Ok(Ok(t)) => t,
        Ok(Err(e)) | Err(e) => {
            let msg = format!("Transcription error: {}", e);
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
    let word_count = cleaned.split_whitespace().count() as i64;

    // Save to DB
    let privacy = *pipeline.privacy_mode.lock().unwrap();
    if !privacy {
        if let Some(db_state) = app.try_state::<DbState>() {
            let conn = db_state.0.lock().unwrap();
            let _ = conn.execute(
                "INSERT INTO dictation_history (app_name, app_exe, raw_text, cleaned_text, word_count, duration_secs, language) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![app_name, app_exe, raw, cleaned, word_count, duration_secs, language],
            );
        }
    }

    app.emit(
        "processing-done",
        serde_json::json!({
            "raw": raw,
            "cleaned": cleaned,
            "word_count": word_count,
            "app_name": app_name,
        }),
    )
    .ok();

    // Inject
    if let Err(e) = inject::inject_text_clipboard(cleaned).await {
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
    if let Some(b) = app.get_webview_window("bubble") {
        b.show().ok();
    }
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
    if let Some(b) = app.get_webview_window("bubble") {
        b.hide().ok();
    }
    {
        *audio.stream.lock().unwrap() = None;
        *audio.is_recording.lock().unwrap() = false;
    }

    let audio_arc = audio.inner().clone();
    let pipeline_arc = pipeline.inner().clone();
    run_pipeline(&app, &audio_arc, &pipeline_arc).await;

    Ok(serde_json::json!({"status": "done"}))
}
