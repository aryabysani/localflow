/// pipeline.rs — State management for the recording pipeline
/// The actual transcription logic is in lib.rs to avoid circular deps.

use tauri::State;
use std::sync::Arc;

pub struct PipelineState {
    pub privacy_mode: std::sync::Mutex<bool>,
    pub is_processing: std::sync::Mutex<bool>,
    pub current_language: std::sync::Mutex<String>,
}

impl PipelineState {
    pub fn new() -> Self {
        Self {
            privacy_mode: std::sync::Mutex::new(false),
            is_processing: std::sync::Mutex::new(false),
            current_language: std::sync::Mutex::new("en".to_string()),
        }
    }
}

#[tauri::command]
pub fn toggle_privacy_mode(pipeline: State<'_, Arc<PipelineState>>) -> bool {
    let mut mode = pipeline.privacy_mode.lock().unwrap();
    *mode = !*mode;
    *mode
}

#[tauri::command]
pub fn get_privacy_mode(pipeline: State<'_, Arc<PipelineState>>) -> bool {
    *pipeline.privacy_mode.lock().unwrap()
}

#[tauri::command]
pub fn set_language(pipeline: State<'_, Arc<PipelineState>>, language: String) {
    *pipeline.current_language.lock().unwrap() = language;
}

#[tauri::command]
pub fn get_pipeline_status(pipeline: State<'_, Arc<PipelineState>>) -> serde_json::Value {
    serde_json::json!({
        "is_processing": *pipeline.is_processing.lock().unwrap(),
        "privacy_mode": *pipeline.privacy_mode.lock().unwrap(),
        "language": *pipeline.current_language.lock().unwrap(),
    })
}
