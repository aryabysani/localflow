use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::io::Write;
use tauri::{AppHandle, Manager, Emitter};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};
use serde::{Deserialize, Serialize};
use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub url: String,
    pub size_mb: u32,
    pub ram_mb: u32,
    pub description: String,
}

pub fn available_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "tiny.en".into(),
            name: "Tiny English".into(),
            filename: "ggml-tiny.en-q5_1.bin".into(),
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin".into(),
            size_mb: 32,
            ram_mb: 128,
            description: "Fastest, lowest accuracy. Good for quick notes.".into(),
        },
        ModelInfo {
            id: "base.en".into(),
            name: "Base English".into(),
            filename: "ggml-base.en-q5_1.bin".into(),
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin".into(),
            size_mb: 57,
            ram_mb: 200,
            description: "Fast with decent accuracy.".into(),
        },
        ModelInfo {
            id: "small.en".into(),
            name: "Small English (Default)".into(),
            filename: "ggml-small.en-q5_1.bin".into(),
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin".into(),
            size_mb: 190,
            ram_mb: 500,
            description: "Recommended. Best speed/accuracy balance on your hardware.".into(),
        },
        ModelInfo {
            id: "medium.en".into(),
            name: "Medium English".into(),
            filename: "ggml-medium.en-q5_1.bin".into(),
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_1.bin".into(),
            size_mb: 515,
            ram_mb: 1200,
            description: "Higher accuracy, slower. Good for important documents.".into(),
        },
        ModelInfo {
            id: "distil-large-v3".into(),
            name: "Distil-Whisper Large V3".into(),
            filename: "ggml-distil-large-v3.bin".into(),
            url: "https://huggingface.co/distil-whisper/distil-large-v3-ggml/resolve/main/ggml-distil-large-v3.bin".into(),
            size_mb: 756,
            ram_mb: 1000,
            description: "Distilled Large V3. 2x faster than standard Large with near-identical English accuracy.".into(),
        },
        ModelInfo {
            id: "large-v3-turbo".into(),
            name: "Large V3 Turbo (Multilingual)".into(),
            filename: "ggml-large-v3-turbo-q5_0.bin".into(),
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin".into(),
            size_mb: 874,
            ram_mb: 1800,
            description: "Best multilingual + Hinglish support. Recommended for non-English.".into(),
        },
    ]
}

pub fn get_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    path.push("models");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn get_active_model_filename(app: &AppHandle) -> String {
    let mut settings_path = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(_) => return "ggml-small.en-q5_1.bin".to_string(),
    };
    settings_path.push("settings.json");
    
    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).unwrap_or_default();
        let val: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
        val["active_model"]
            .as_str()
            .unwrap_or("ggml-small.en-q5_1.bin")
            .to_string()
    } else {
        "ggml-small.en-q5_1.bin".to_string()
    }
}

pub fn get_active_model_path(app: &AppHandle) -> Result<PathBuf, String> {
    let models_dir = get_models_dir(app)?;
    let active_filename = get_active_model_filename(app);
    Ok(models_dir.join(active_filename))
}

#[tauri::command]
pub fn list_models(app: AppHandle) -> Vec<serde_json::Value> {
    let models = available_models();
    let models_dir = get_models_dir(&app).unwrap_or_default();
    let active_filename = get_active_model_filename(&app);

    models
        .iter()
        .map(|m| {
            let path = models_dir.join(&m.filename);
            let downloaded = path.exists();
            let size_on_disk = if downloaded {
                fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0)
            } else {
                0
            };
            serde_json::json!({
                "id": m.id,
                "name": m.name,
                "filename": m.filename,
                "url": m.url,
                "size_mb": m.size_mb,
                "ram_mb": m.ram_mb,
                "description": m.description,
                "downloaded": downloaded,
                "size_on_disk": size_on_disk,
                "is_active": m.filename == active_filename,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    model_id: String,
) -> Result<String, String> {
    let models = available_models();
    let model = models
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?
        .clone();

    let models_dir = get_models_dir(&app)?;
    let dest_path = models_dir.join(&model.filename);

    if dest_path.exists() {
        return Ok(format!("Model {} already downloaded", model.name));
    }

    println!("Downloading model {} from {}...", model.name, model.url);

    let response = reqwest::get(&model.url)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    let total_size = response
        .content_length()
        .ok_or_else(|| "Failed to get content length".to_string())?;

    let tmp_path = dest_path.with_extension("download");
    if tmp_path.exists() {
        let _ = fs::remove_file(&tmp_path);
    }

    let mut file = std::fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();
    let mut stream = response.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            format!("Error while downloading: {}", e)
        })?;

        file.write_all(&chunk).map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            format!("Failed to write chunk: {}", e)
        })?;

        downloaded += chunk.len() as u64;
        let percent = (downloaded * 100 / total_size) as u32;

        if last_emit.elapsed().as_millis() > 100 || percent == 100 {
            app.emit(
                "download-progress",
                serde_json::json!({
                    "id": model.id,
                    "progress": percent,
                }),
            )
            .ok();
            last_emit = std::time::Instant::now();
        }
    }

    file.sync_all().map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("Failed to sync file: {}", e)
    })?;
    drop(file);

    if let Err(e) = fs::rename(&tmp_path, &dest_path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("Failed to save final model file: {}", e));
    }

    println!("Model saved to {:?}", dest_path);
    Ok(format!("Downloaded {} ({} MB)", model.name, downloaded / 1_000_000))
}

#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    audio_state: tauri::State<'_, Arc<crate::audio::AudioState>>,
    language: Option<String>,
    initial_prompt: Option<String>,
) -> Result<String, String> {
    let audio_data: Vec<f32> = {
        let mut buffer = audio_state.buffer.lock().unwrap();
        if buffer.is_empty() {
            return Err("Audio buffer is empty".into());
        }
        buffer.drain(..).collect()
    };

    let model_path = get_active_model_path(&app)?;

    if !model_path.exists() {
        return Err(format!(
            "Model not found at {:?}. Please download a model first.",
            model_path
        ));
    }

    let lang = language.unwrap_or_else(|| "en".to_string());
    let prompt = initial_prompt.unwrap_or_default();

    let result = tauri::async_runtime::spawn_blocking(move || {
        let model_path_str = model_path.to_str().unwrap().to_string();

        let ctx = WhisperContext::new_with_params(
            &model_path_str,
            WhisperContextParameters::default(),
        )
        .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

        let mut state = ctx
            .create_state()
            .map_err(|e| format!("Failed to create Whisper state: {}", e))?;

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

        state
            .full(params, &audio_data[..])
            .map_err(|e| format!("Transcription failed: {}", e))?;

        let num_segments = state.full_n_segments();
        let mut transcription = String::new();

        for i in 0..num_segments {
            if let Some(segment) = state.get_segment(i) {
                if let Ok(text) = segment.to_str() {
                    transcription.push_str(text);
                }
            }
        }

        Ok::<String, String>(transcription.trim().to_string())
    })
    .await
    .map_err(|e| format!("Thread panicked: {}", e))??;

    Ok(result)
}

#[tauri::command]
pub fn set_active_model(app: AppHandle, filename: String) -> Result<(), String> {
    let mut settings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    settings_path.push("settings.json");

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    settings["active_model"] = serde_json::json!(filename);
    fs::write(&settings_path, serde_json::to_string_pretty(&settings).unwrap())
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let models = available_models();
    let model = models
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;

    let models_dir = get_models_dir(&app)?;
    let dest_path = models_dir.join(&model.filename);

    if dest_path.exists() {
        fs::remove_file(&dest_path).map_err(|e| format!("Failed to delete model file: {}", e))?;
    }

    // Reset active model settings if the deleted model was active
    let mut settings_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    settings_path.push("settings.json");

    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).unwrap_or_default();
        let mut val: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
        if let Some(active) = val["active_model"].as_str() {
            if active == model.filename {
                val["active_model"] = serde_json::json!("ggml-small.en-q5_1.bin");
                let _ = fs::write(&settings_path, serde_json::to_string_pretty(&val).unwrap());
            }
        }
    }

    Ok(())
}
