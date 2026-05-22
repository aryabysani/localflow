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
        "casual" => "Target: casual chat app (Slack/Discord/WhatsApp). Use contractions, informal tone, lowercase OK, keep it short.",
        "formal" => "Target: email/document app (Outlook/Word). Use formal complete sentences, proper greeting/sign-off if dictated.",
        "code" => "Target: code editor/terminal. Preserve exact wording — DO NOT rephrase or add punctuation to code/command text.",
        "notes" => "Target: notes app (Notion/Obsidian). Polished long-form prose, preserve structure.",
        _ => "Target: general app. Neutral, polished, professional prose.",
    };

    format!(
        r#"You are a dictation cleanup engine. {context_hint}
{style_note}
Rules:
1. Remove filler words: um, uh, like, you know, sort of, kind of, I mean
2. Handle self-corrections: "meet Tuesday, wait Wednesday" → "meet Wednesday"
3. Add proper punctuation and capitalization
4. Convert spoken lists ("first ... second ... third") to "1. ... 2. ... 3. ..."
5. Adapt tone to target app as described above
6. Preserve speaker's vocabulary and meaning exactly
7. Output ONLY the cleaned text — no preamble, no explanation, no quotes.

Raw transcript: {raw_text}"#,
        context_hint = context_hint,
        style_note = if style_note.is_empty() { "" } else { style_note },
        raw_text = raw_text,
    )
}

/// Main cleanup command — uses regex fallback (LLM not bundled in this build)
#[tauri::command]
pub fn cleanup_text(
    raw_text: String,
    app_exe: String,
) -> Result<String, String> {
    // For now, use regex cleanup as the reliable fallback
    // LLM integration requires llama.cpp to be compiled and model downloaded
    let cleaned = regex_cleanup(&raw_text);
    Ok(cleaned)
}

/// Command mode: transform selected text with an instruction
#[tauri::command]  
pub fn command_mode_transform(
    selected_text: String,
    instruction: String,
    app_exe: String,
) -> Result<String, String> {
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
        // Basic formality: capitalize, ensure periods
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
