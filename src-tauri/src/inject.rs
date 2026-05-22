/// inject.rs — Text injection via Windows SendInput API
/// Also provides foreground app detection via GetForegroundWindow.

#[cfg(windows)]
mod win {
    pub use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
        KEYEVENTF_KEYUP, KEYEVENTF_UNICODE, VIRTUAL_KEY, VK_CONTROL, VK_RETURN, VK_V,
    };
    pub use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND};
    pub use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };
    pub use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };
    pub use windows::Win32::System::ProcessStatus::GetModuleFileNameExW;
    pub use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
    };
    pub use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
    pub use windows::Win32::System::Ole::CF_UNICODETEXT;
}

/// Inject text by typing each character via SendInput with KEYEVENTF_UNICODE.
#[tauri::command]
pub fn inject_text(text: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use win::*;
        use std::mem::size_of;

        std::thread::sleep(std::time::Duration::from_millis(50));

        for ch in text.chars() {
            if (ch as u32) > 0xFFFF {
                continue; // Skip supplementary plane chars for now
            }
            let code = ch as u16;

            if ch == '\n' {
                let inputs = [
                    INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VK_RETURN,
                                wScan: 0,
                                dwFlags: Default::default(),
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    },
                    INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VK_RETURN,
                                wScan: 0,
                                dwFlags: KEYEVENTF_KEYUP,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    },
                ];
                unsafe { SendInput(&inputs, size_of::<INPUT>() as i32); }
            } else {
                let inputs = [
                    INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VIRTUAL_KEY(0),
                                wScan: code,
                                dwFlags: KEYEVENTF_UNICODE,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    },
                    INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VIRTUAL_KEY(0),
                                wScan: code,
                                dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    },
                ];
                unsafe { SendInput(&inputs, size_of::<INPUT>() as i32); }
            }
            std::thread::sleep(std::time::Duration::from_micros(500));
        }
        Ok(())
    }

    #[cfg(not(windows))]
    Err("Text injection only supported on Windows".into())
}

/// Paste text via clipboard (faster for long texts)
#[tauri::command]
pub async fn inject_text_clipboard(text: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use win::*;
        use std::mem::size_of;

        set_clipboard_text(&text)?;
        tokio::time::sleep(std::time::Duration::from_millis(80)).await;

        // Send Ctrl+V
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: Default::default(),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_V,
                        wScan: 0,
                        dwFlags: Default::default(),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_V,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];

        unsafe { SendInput(&inputs, size_of::<INPUT>() as i32); }
        Ok(())
    }

    #[cfg(not(windows))]
    Err("Clipboard injection only supported on Windows".into())
}

#[cfg(windows)]
fn set_clipboard_text(text: &str) -> Result<(), String> {
    use win::*;

    let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0u16)).collect();
    let size_bytes = wide.len() * std::mem::size_of::<u16>();

    unsafe {
        OpenClipboard(HWND::default()).map_err(|e| format!("OpenClipboard: {}", e))?;

        if EmptyClipboard().is_err() {
            let _ = CloseClipboard();
            return Err("EmptyClipboard failed".into());
        }

        let hmem = GlobalAlloc(GMEM_MOVEABLE, size_bytes)
            .map_err(|e| format!("GlobalAlloc: {}", e))?;

        let ptr = GlobalLock(hmem);
        if ptr.is_null() {
            let _ = CloseClipboard();
            return Err("GlobalLock failed".into());
        }

        std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr as *mut u16, wide.len());
        let _ = GlobalUnlock(hmem);

        // CF_UNICODETEXT = 13
        if SetClipboardData(13, HANDLE(hmem.0 as *mut std::ffi::c_void)).is_err() {
            let _ = CloseClipboard();
            return Err("SetClipboardData failed".into());
        }

        CloseClipboard().map_err(|e| format!("CloseClipboard: {}", e))?;
    }

    Ok(())
}

/// Get the name and exe of the currently focused application
#[tauri::command]
pub fn get_foreground_app() -> (String, String) {
    #[cfg(windows)]
    {
        use win::*;

        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return ("Unknown".into(), "unknown.exe".into());
            }

            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));

            let proc = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);

            let exe_name = match proc {
                Ok(handle) => {
                    let mut path_buf = [0u16; 260];
                    let len = GetModuleFileNameExW(handle, None, &mut path_buf);
                    let path = String::from_utf16_lossy(&path_buf[..len as usize]);
                    let _ = CloseHandle(handle);
                    std::path::Path::new(&path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown.exe")
                        .to_lowercase()
                }
                Err(_) => "unknown.exe".into(),
            };

            let app_name = exe_to_friendly_name(&exe_name);
            (app_name, exe_name)
        }
    }

    #[cfg(not(windows))]
    ("Unknown".into(), "unknown".into())
}

fn exe_to_friendly_name(exe: &str) -> String {
    match exe {
        "chrome.exe" => "Google Chrome",
        "msedge.exe" => "Microsoft Edge",
        "firefox.exe" => "Firefox",
        "code.exe" => "VS Code",
        "slack.exe" => "Slack",
        "discord.exe" => "Discord",
        "outlook.exe" => "Outlook",
        "winword.exe" => "Microsoft Word",
        "excel.exe" => "Microsoft Excel",
        "notion.exe" => "Notion",
        "obsidian.exe" => "Obsidian",
        "notepad.exe" => "Notepad",
        "notepad++.exe" => "Notepad++",
        "whatsapp.exe" => "WhatsApp",
        "teams.exe" => "Microsoft Teams",
        "zoom.exe" => "Zoom",
        "telegram.exe" => "Telegram",
        "cursor.exe" => "Cursor",
        "windowsterminal.exe" => "Windows Terminal",
        "powershell.exe" => "PowerShell",
        "cmd.exe" => "Command Prompt",
        _ => exe.trim_end_matches(".exe"),
    }
    .to_string()
}
