import { Cpu, ExternalLink, Lock, Mic, Zap } from "lucide-react";

const DEPS = [
  { name: "whisper.cpp", license: "MIT", url: "https://github.com/ggml-org/whisper.cpp" },
  { name: "whisper-rs", license: "MIT", url: "https://github.com/tazz4843/whisper-rs" },
  { name: "Tauri", license: "Apache-2.0 / MIT", url: "https://tauri.app" },
  { name: "cpal", license: "Apache-2.0", url: "https://github.com/RustAudio/cpal" },
  { name: "rusqlite", license: "MIT", url: "https://github.com/rusqlite/rusqlite" },
  { name: "React", license: "MIT", url: "https://react.dev" },
  { name: "Recharts", license: "MIT", url: "https://recharts.org" },
  { name: "Zustand", license: "MIT", url: "https://github.com/pmndrs/zustand" },
];

const NOTES = [
  "Audio and transcripts stay on your machine.",
  "No subscription, account, or API key is required.",
  "Style memory and history are stored locally in SQLite.",
  "Windows desktop only in this build.",
];

export default function AboutPage() {
  return (
    <div className="page narrow">
      <section className="glass-panel about-hero">
        <div className="about-lockup">
          <div className="brand-icon about-icon">
            <Mic size={24} />
          </div>
          <div>
            <h2 className="page-title" style={{ fontSize: 26, lineHeight: "32px" }}>FlowLocal</h2>
            <p className="page-kicker">Version 0.1.0 · local voice to text</p>
          </div>
        </div>
        <p className="about-copy">
          FlowLocal is a privacy-first desktop dictation app for Windows. Speak naturally, clean the transcript locally,
          and paste the result into the app you are already using.
        </p>
      </section>

      <section className="grid cols-3" style={{ marginBottom: 16 }}>
        {[
          [Lock, "Local by default", "No cloud transcription in the hot path."],
          [Zap, "Fast capture", "Short recordings are processed immediately."],
          [Cpu, "Native backend", "Rust, Tauri, SQLite, and Whisper."],
        ].map(([Icon, title, desc]) => (
          <div key={title as string} className="stat-card">
            <Icon size={18} color="var(--accent)" />
            <div className="row-title" style={{ marginTop: 8 }}>{title as string}</div>
            <div className="row-desc">{desc as string}</div>
          </div>
        ))}
      </section>

      <section className="table-panel" style={{ marginBottom: 16 }}>
        {NOTES.map((note) => (
          <div key={note} className="setting-row">
            <span className="row-title">{note}</span>
            <span className="badge">FlowLocal</span>
          </div>
        ))}
      </section>

      <section>
        <div className="section-label">Open source dependencies</div>
        <div className="table-panel">
          {DEPS.map((dep) => (
            <div key={dep.name} className="setting-row">
              <a href={dep.url} target="_blank" rel="noreferrer" className="license-link">
                {dep.name}
                <ExternalLink size={12} />
              </a>
              <span className="keycap">{dep.license}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
