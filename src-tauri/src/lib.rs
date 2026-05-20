mod audio;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_state = std::sync::Arc::new(audio::AudioState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(audio_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            audio::start_audio_capture,
            audio::stop_audio_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
