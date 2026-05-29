use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::io::Write;
use tauri::{AppHandle, Manager, Emitter};
use serde::{Deserialize, Serialize};
use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LlmModelInfo {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub url: String,
    pub size_mb: u32,
    pub description: String,
}

pub fn available_llm_models() -> Vec<LlmModelInfo> {
    vec![
        LlmModelInfo {
            id: "llama-3.2-1b".into(),
            name: "Llama 3.2 1B Instruct (Recommended)".into(),
            filename: "Llama-3.2-1B-Instruct-Q4_K_M.gguf".into(),
            url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf".into(),
            size_mb: 702,
            description: "Fastest option, perfect for formatting dictation on CPU and low RAM.".into(),
        },
        LlmModelInfo {
            id: "qwen-2.5-0.5b".into(),
            name: "Qwen 2.5 0.5B Instruct".into(),
            filename: "qwen2.5-0.5b-instruct-q4_k_m.gguf".into(),
            url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf".into(),
            size_mb: 350,
            description: "Ultra-lightweight and fast, ideal for low-end hardware.".into(),
        },
    ]
}

pub fn get_llm_bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    path.push("bin");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn get_llm_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    path.push("llm_models");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
pub fn list_llm_models(app: AppHandle) -> Vec<serde_json::Value> {
    let models = available_llm_models();
    let models_dir = get_llm_models_dir(&app).unwrap_or_default();
    let active_filename = get_llm_setting(&app, "llm_active_model", "Llama-3.2-1B-Instruct-Q4_K_M.gguf");

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
                "description": m.description,
                "downloaded": downloaded,
                "size_on_disk": size_on_disk,
                "is_active": m.filename == active_filename,
            })
        })
        .collect()
}

#[tauri::command]
pub fn is_llama_cli_installed(app: AppHandle) -> bool {
    let bin_dir = match get_llm_bin_dir(&app) {
        Ok(d) => d,
        Err(_) => return false,
    };
    let cli_path = bin_dir.join("llama-cli.exe");
    if cli_path.exists() {
        return true;
    }
    // Automatically rename main.exe if it was extracted from older llama.cpp releases
    let main_exe = bin_dir.join("main.exe");
    if main_exe.exists() {
        if fs::rename(&main_exe, &cli_path).is_ok() {
            return true;
        }
    }
    false
}

#[tauri::command]
pub async fn download_llama_cli(app: AppHandle) -> Result<String, String> {
    let bin_dir = get_llm_bin_dir(&app)?;
    let cli_path = bin_dir.join("llama-cli.exe");

    if cli_path.exists() {
        return Ok("llama-cli already installed".into());
    }

    let url = "https://github.com/ggml-org/llama.cpp/releases/download/b3040/llama-b3040-bin-win-avx2-x64.zip";
    let dest_zip = bin_dir.join("llama-bin.zip");

    println!("Downloading llama.cpp precompiled binaries...");
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    let total_size = response
        .content_length()
        .ok_or_else(|| "Failed to get content length".to_string())?;

    let mut file = std::fs::File::create(&dest_zip)
        .map_err(|e| format!("Failed to save zip file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();
    let mut stream = response.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| {
            let _ = fs::remove_file(&dest_zip);
            format!("Error while downloading: {}", e)
        })?;

        file.write_all(&chunk).map_err(|e| {
            let _ = fs::remove_file(&dest_zip);
            format!("Failed to write chunk: {}", e)
        })?;

        downloaded += chunk.len() as u64;
        let percent = (downloaded * 100 / total_size) as u32;

        if last_emit.elapsed().as_millis() > 100 || percent == 100 {
            app.emit(
                "download-progress",
                serde_json::json!({
                    "id": "llama-cli",
                    "progress": percent,
                }),
            )
            .ok();
            last_emit = std::time::Instant::now();
        }
    }

    file.sync_all().map_err(|e| {
        let _ = fs::remove_file(&dest_zip);
        format!("Failed to sync zip file: {}", e)
    })?;
    drop(file);

    println!("Extracting llama.cpp zip using system tar...");
    
    // tar is native to Windows 10/11
    let status = Command::new("tar")
        .args([
            "-xf",
            dest_zip.to_str().unwrap(),
            "-C",
            bin_dir.to_str().unwrap(),
        ])
        .status()
        .map_err(|e| format!("Failed to run tar: {}", e))?;

    // Cleanup zip file
    let _ = fs::remove_file(&dest_zip);

    if !status.success() {
        return Err("Extraction failed".into());
    }

    let main_exe = bin_dir.join("main.exe");
    if main_exe.exists() && !cli_path.exists() {
        let _ = fs::rename(&main_exe, &cli_path);
    }

    if cli_path.exists() {
        Ok("llama-cli successfully installed".into())
    } else {
        Err("llama-cli.exe not found after extraction".into())
    }
}

#[tauri::command]
pub async fn download_llm_model(app: AppHandle, model_id: String) -> Result<String, String> {
    let models = available_llm_models();
    let model = models
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?
        .clone();

    let models_dir = get_llm_models_dir(&app)?;
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

    Ok(format!("Downloaded {} ({} MB)", model.name, downloaded / 1_000_000))
}

pub fn run_inference(
    app: &AppHandle,
    prompt: &str,
) -> Result<String, String> {
    let bin_dir = get_llm_bin_dir(app)?;
    let cli_path = bin_dir.join("llama-cli.exe");

    if !cli_path.exists() {
        return Err("llama-cli.exe is not installed".into());
    }

    // Get active model
    let models_dir = get_llm_models_dir(app)?;
    let active_model = get_llm_setting(app, "llm_active_model", "Llama-3.2-1B-Instruct-Q4_K_M.gguf");
    let model_path = models_dir.join(&active_model);

    if !model_path.exists() {
        return Err(format!("LLM model file not found at {:?}", model_path));
    }

    // Create a temporary prompt file to prevent command line length issues
    let mut temp_dir = std::env::temp_dir();
    let file_id = uuid::Uuid::new_v4().to_string();
    temp_dir.push(format!("localflow_prompt_{}.txt", file_id));

    let active_model_lower = active_model.to_lowercase();
    let (formatted_prompt, stop_token) = if active_model_lower.contains("llama") {
        (
            format!(
                "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are a precise text post-processing assistant. Output only the final formatted text. Do not explain.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                prompt
            ),
            Some("<|eot_id|>")
        )
    } else if active_model_lower.contains("qwen") {
        (
            format!(
                "<|im_start|>system\nYou are a precise text post-processing assistant. Output only the final formatted text. Do not explain.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                prompt
            ),
            Some("<|im_end|>")
        )
    } else {
        (prompt.to_string(), None)
    };

    fs::write(&temp_dir, &formatted_prompt)
        .map_err(|e| format!("Failed to write temporary prompt file: {}", e))?;

    println!("Running offline llama-cli inference with template wrapping...");
    let mut args = vec![
        "-m".to_string(),
        model_path.to_str().unwrap().to_string(),
        "-f".to_string(),
        temp_dir.to_str().unwrap().to_string(),
        "--temp".to_string(),
        "0.1".to_string(),
        "-n".to_string(),
        "512".to_string(),
        "--repeat-penalty".to_string(),
        "1.15".to_string(),
        "--no-display-prompt".to_string(),
    ];

    if let Some(stop) = stop_token {
        args.push("-r".to_string());
        args.push(stop.to_string());
    }

    let output = Command::new(&cli_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run llama-cli subprocess: {}", e))?;

    // Cleanup prompt file
    let _ = fs::remove_file(&temp_dir);

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Inference subprocess failed: {}", err_msg));
    }

    let mut result = String::from_utf8_lossy(&output.stdout).to_string();
    result = result.trim().to_string();
    
    Ok(result)
}

fn get_llm_setting(app: &AppHandle, key: &str, default: &str) -> String {
    if let Some(db_state) = app.try_state::<crate::db::DbState>() {
        let conn = db_state.0.lock().unwrap();
        let val: Result<String, _> = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        );
        val.unwrap_or_else(|_| default.to_string())
    } else {
        default.to_string()
    }
}
