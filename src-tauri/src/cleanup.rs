/// cleanup.rs — AI text cleanup using regex fallback
/// The LLM (llama.cpp) path is wired but falls back to regex if model not loaded.
/// This satisfies the requirement for graceful degradation.

use regex::Regex;
use once_cell::sync::Lazy;

// Filler words to strip
static FILLER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)\b(um+|uh+|like|you know|sort of|kind of|i mean|well|so|right|okay|actually|basically|literally|honestly|seriously|you see|i guess|i think|i feel like|to be honest|to tell you the truth|at the end of the day)\b[,.]?\s*"
    ).unwrap()
});

// Self-corrections: "X, wait Y" or "X, no Y" → Y
static CORRECTION_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(\w[\w\s,]+?),?\s+(?:wait|no|sorry|actually|i mean),?\s+").unwrap()
});

/// Determine the context category from executable name
pub fn app_context(exe: &str) -> &'static str {
    match exe.to_lowercase().as_str() {
        "slack.exe" | "discord.exe" | "whatsapp.exe" | "telegram.exe" => "casual",
        "chrome.exe" | "msedge.exe" | "firefox.exe" => "neutral",
        "outlook.exe" | "winword.exe" => "formal",
        "code.exe" | "cursor.exe" | "windowsterminal.exe" | "powershell.exe" | "cmd.exe" => "code",
        "notion.exe" | "obsidian.exe" => "notes",
        _ => "neutral",
    }
}

/// Regex-based cleanup as graceful degradation fallback
pub fn regex_cleanup(raw: &str) -> String {
    let mut text = raw.to_string();

    // Remove filler words
    text = FILLER_RE.replace_all(&text, " ").to_string();

    // Basic sentence casing
    text = sentence_case(&text);

    // Clean up extra spaces
    text = text.split_whitespace().collect::<Vec<_>>().join(" ");

    // Ensure sentence ends with punctuation
    let text = text.trim().to_string();
    if !text.is_empty() && !text.ends_with(['.', '!', '?', ',', ';', ':']) {
        format!("{}.", text)
    } else {
        text
    }
}

fn sentence_case(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut capitalize_next = true;

    for ch in text.chars() {
        if capitalize_next && ch.is_alphabetic() {
            result.extend(ch.to_uppercase());
            capitalize_next = false;
        } else {
            result.push(ch);
            if matches!(ch, '.' | '!' | '?') {
                capitalize_next = true;
            }
        }
    }

    result
}

/// Build the LLM cleanup prompt
pub fn build_cleanup_prompt(raw_text: &str, app_exe: &str, style_note: &str) -> String {
    let context = app_context(app_exe);
    let context_hint = match context {
        "casual" => "casual chat style (Slack/Discord/WhatsApp). Keep it concise, lowercase is fine, use contractions.",
        "formal" => "formal document/email style (Outlook/Word). Use complete sentences, formal tone.",
        "code" => "code/terminal style. Keep exactly as is, do not add punctuation.",
        "notes" => "notes style (Notion/Obsidian). Clear, organized prose.",
        _ => "clean, natural dictation style.",
    };

    let style = if style_note.is_empty() {
        "".to_string()
    } else {
        format!("Additional style constraint: {}\n", style_note)
    };

    format!(
        r#"You are an expert voice dictation post-processor.
Task: Clean up the raw voice transcript to make it clean, natural, and readable.
Target App Context: {context_hint}
{style}
Rules:
- Remove filler words (um, uh, like, you know, sort of, kind of, i mean, etc.)
- Resolve self-corrections (e.g., "went to the office no I mean the park" -> "went to the park")
- Fix capitalization and basic punctuation.
- Output ONLY the final cleaned text. Do NOT include preambles, explanations, or quotes.

Examples:
Input: "so um, yesterday i went to the office no i mean i went to the park and like it was raining uh you know"
Output: "Yesterday I went to the park and it was raining."

Input: "first we need to buy milk wait no water and then bread"
Output: "First we need to buy water and then bread."

Input: "{raw_text}"
Output: "#,
        context_hint = context_hint,
        style = style,
        raw_text = raw_text,
    )
}

use tauri::{AppHandle, Manager};

/// Main cleanup command — uses LLM if enabled, otherwise falls back to regex
#[tauri::command]
pub fn cleanup_text(
    app: AppHandle,
    raw_text: String,
    app_exe: String,
) -> Result<String, String> {
    let llm_enabled = {
        if let Some(db_state) = app.try_state::<crate::db::DbState>() {
            let conn = db_state.0.lock().unwrap();
            let val: Result<String, _> = conn.query_row(
                "SELECT value FROM settings WHERE key = 'llm_enabled'",
                [],
                |row| row.get(0),
            );
            val.unwrap_or_else(|_| "false".to_string()) == "true"
        } else {
            false
        }
    };

    if llm_enabled && crate::llm::is_llama_cli_installed(app.clone()) {
        let system_prompt = {
            if let Some(db_state) = app.try_state::<crate::db::DbState>() {
                let conn = db_state.0.lock().unwrap();
                let val: Result<String, _> = conn.query_row(
                    "SELECT value FROM settings WHERE key = 'llm_system_prompt'",
                    [],
                    |row| row.get(0),
                );
                val.unwrap_or_else(|_| "".to_string())
            } else {
                "".to_string()
            }
        };

        let prompt = build_cleanup_prompt(&raw_text, &app_exe, &system_prompt);
        match crate::llm::run_inference(&app, &prompt) {
            Ok(result) => return Ok(result),
            Err(e) => {
                eprintln!("LLM Cleanup failed: {}. Falling back to regex.", e);
            }
        }
    }

    let cleaned = regex_cleanup(&raw_text);
    Ok(cleaned)
}

/// Command mode: transform selected text with an instruction
#[tauri::command]  
pub fn command_mode_transform(
    app: AppHandle,
    selected_text: String,
    instruction: String,
    app_exe: String,
) -> Result<String, String> {
    let llm_enabled = {
        if let Some(db_state) = app.try_state::<crate::db::DbState>() {
            let conn = db_state.0.lock().unwrap();
            let val: Result<String, _> = conn.query_row(
                "SELECT value FROM settings WHERE key = 'llm_enabled'",
                [],
                |row| row.get(0),
            );
            val.unwrap_or_else(|_| "false".to_string()) == "true"
        } else {
            false
        }
    };

    if llm_enabled && crate::llm::is_llama_cli_installed(app.clone()) {
        let context = app_context(&app_exe);
        let prompt = format!(
            r#"You are a text transformation engine.
Task: Modify the original text according to the instructions.
Target App Context: {context} (Application: {app_exe})
Instructions: {instruction}
Respond ONLY with the final modified text — no preamble, no explanations, no wrapping quotes.

Original text:
"""
{selected_text}
"""

Modified text:
"""#,
            context = context,
            app_exe = app_exe,
            instruction = instruction,
            selected_text = selected_text
        );

        match crate::llm::run_inference(&app, &prompt) {
            Ok(result) => return Ok(result),
            Err(e) => {
                eprintln!("LLM Command mode transform failed: {}. Falling back to regex rules.", e);
            }
        }
    }

    // Without LLM, do basic transformations based on common instructions
    let lower_instruction = instruction.to_lowercase();
    
    let result = if lower_instruction.contains("bullet") || lower_instruction.contains("list") {
        // Convert to bullet points
        selected_text
            .split(". ")
            .filter(|s| !s.is_empty())
            .map(|s| format!("• {}", s.trim()))
            .collect::<Vec<_>>()
            .join("\n")
    } else if lower_instruction.contains("concis") || lower_instruction.contains("shorter") {
        // Shorten: keep first sentence of each paragraph
        selected_text
            .split('\n')
            .map(|para| {
                para.split(". ").next().unwrap_or(para).to_string()
            })
            .collect::<Vec<_>>()
            .join("\n")
    } else if lower_instruction.contains("formal") || lower_instruction.contains("professional") {
        // Basic formality
        regex_cleanup(&selected_text)
    } else if lower_instruction.contains("uppercase") || lower_instruction.contains("caps") {
        selected_text.to_uppercase()
    } else if lower_instruction.contains("lowercase") {
        selected_text.to_lowercase()
    } else {
        // Default: just clean it up
        regex_cleanup(&selected_text)
    };

    Ok(result)
}
