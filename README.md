# FlowLocal 🎙️

**100% local voice-to-text for Windows 11. No cloud. No API keys. No subscriptions.**

FlowLocal is a privacy-first desktop dictation app that mirrors the Wispr Flow experience end-to-end — press a hotkey anywhere in Windows, speak naturally, and get clean, punctuated text injected directly at your cursor. Everything runs on your machine using open-source AI models.

---

## Screenshots

> *(Dashboard — Stats, Challenge Ring, WPM Chart)*
> ![Dashboard screenshot placeholder](./docs/screenshot-dashboard.png)

> *(Floating Mic Bubble — live waveform overlay)*
> ![Mic bubble screenshot placeholder](./docs/screenshot-bubble.png)

---

## Why Local?

| Feature | FlowLocal | Cloud STT |
|---|---|---|
| Audio leaves your device | ❌ Never | ✅ Always |
| Works offline | ✅ Yes | ❌ No |
| Monthly cost | $0 | $10–30/month |
| Latency on your hardware | < 2s | 0.5–3s + round-trip |
| GDPR / data sovereignty | ✅ Full control | ❌ Vendor-dependent |
| Works with sensitive content | ✅ Yes | ⚠️ ToS-dependent |

Your voice stays on your machine. Period.

---

## System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| OS | Windows 11 | Windows 11 23H2+ |
| CPU | Intel/AMD (any modern) | Intel Core Ultra (Meteor Lake) |
| GPU | Any (CPU fallback) | Intel Arc / NVIDIA for Vulkan |
| RAM | 8 GB | 16 GB |
| Storage | 500 MB (app) + model | 2 GB with models |

> **Optimized for:** Intel Core Ultra 5 125H + Intel Arc Graphics (the build target hardware).
> Whisper runs via the **Vulkan backend** — no CUDA required.

---

## Installation

1. Download `flowlocal-setup.msi` from [Releases](https://github.com/your-repo/flowlocal/releases)
2. Run the installer
3. On first launch, the setup wizard will:
   - Ask you to choose a microphone
   - Download the default Whisper model (~190 MB)
   - Set your preferred hotkey
   - Run a 5-second test dictation to confirm injection works
4. Press **Ctrl+Shift+Space** anywhere to start dictating

---

## Build from Source

### Prerequisites

```powershell
# Install Rust
winget install Rustlang.Rustup

# Install Node.js + pnpm
winget install OpenJS.NodeJS
npm install -g pnpm

# Install Visual Studio Build Tools (C++ workload required for whisper.cpp)
winget install Microsoft.VisualStudio.2022.BuildTools

# Verify
rustc --version   # >= 1.77
node --version    # >= 20
pnpm --version    # >= 8
```

### Build

```powershell
git clone https://github.com/your-repo/flowlocal
cd flowlocal

# Install frontend dependencies
pnpm install

# Build the app (creates MSI installer)
pnpm tauri build

# The installer will be at:
# src-tauri/target/release/bundle/msi/FlowLocal_0.1.0_x64_en-US.msi
```

### Development

```powershell
# Run in dev mode (hot-reload frontend, Rust rebuilt on change)
pnpm tauri dev
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     FlowLocal (Tauri 2)                      │
│                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │   React Frontend    │    │      Rust Backend            │ │
│  │                     │    │                              │ │
│  │  Dashboard          │    │  audio.rs  — cpal WASAPI     │ │
│  │  History            │◄──►│  whisper.rs — whisper-rs FFI │ │
│  │  Dictionary         │    │  cleanup.rs — regex/LLM      │ │
│  │  Notes              │    │  inject.rs — SendInput API   │ │
│  │  Models             │    │  db.rs — SQLite (rusqlite)   │ │
│  │  Settings           │    │  pipeline.rs — hot path      │ │
│  │  MicBubble overlay  │    │  lib.rs — tray, shortcuts    │ │
│  └─────────────────────┘    └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         │                              │
         │                              │
    ┌────▼────┐                  ┌──────▼──────┐
    │ Recharts│                  │ whisper.cpp  │
    │ Zustand │                  │ (Vulkan GPU) │
    │ shadcn  │                  │             │
    └─────────┘                  │ Qwen 2.5 1.5B│
                                 │ (llama.cpp)  │
                                 └─────────────┘

STT Hot Path:
  Mic → cpal (16kHz mono) → ring buffer
    → Silero VAD (trim silence)
    → whisper.cpp (Vulkan or CPU)
    → raw transcript
    → regex/LLM cleanup
    → Windows SendInput → focused app
```

---

## Differences from Wispr Flow

| Feature | FlowLocal | Wispr Flow |
|---|---|---|
| Processing | 100% local | Cloud (OpenAI Whisper) |
| Price | Free, open source | $10/month |
| Team features | ❌ | ✅ |
| Mobile app | ❌ Windows only | ✅ macOS + iOS |
| Style learning | Local SQLite | Cloud profile |
| HIPAA compliance | ❌ personal-use | ✅ enterprise |
| Hinglish support | ✅ Qwen 2.5 | Limited |
| Offline use | ✅ Full | ❌ Requires internet |

---

## Hotkeys

| Action | Shortcut |
|---|---|
| Toggle dictation | `Ctrl + Shift + Space` |
| Cancel (no inject) | `Esc` |
| Command Mode | `Right Ctrl + Right Alt` *(planned)* |

---

## OSS Licenses

| Library | License |
|---|---|
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT |
| [whisper-rs](https://github.com/tazz4843/whisper-rs) | MIT |
| [Tauri](https://tauri.app) | Apache-2.0 / MIT |
| [cpal](https://github.com/RustAudio/cpal) | Apache-2.0 |
| [rusqlite](https://github.com/rusqlite/rusqlite) | MIT |
| [React](https://react.dev) | MIT |
| [Recharts](https://recharts.org) | MIT |
| [Zustand](https://github.com/pmndrs/zustand) | MIT |
| [Lucide React](https://lucide.dev) | ISC |
| Tailwind CSS | MIT |

---

## Privacy

**No telemetry. No analytics. No network calls** except:
- Model downloads from HuggingFace (on-demand, user-initiated)
- Optional update check against GitHub Releases API (disabled by default)

FlowLocal never sends audio, transcripts, or usage data anywhere. See `src-tauri/src/lib.rs` — there are no outbound network calls in the hot path.

---

## Contributing

PRs welcome. The codebase is structured so each module is independent:
- Add a new STT backend → `src-tauri/src/whisper.rs`
- Add new UI pages → `src/routes/`
- Change injection strategy → `src-tauri/src/inject.rs`

---

*Made with ❤️ for the privacy-conscious power user.*
