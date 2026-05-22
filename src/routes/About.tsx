import { Heart, Lock, Zap, Cpu, ExternalLink } from "lucide-react";

const DEPS = [
  { name: "whisper.cpp", license: "MIT", url: "https://github.com/ggml-org/whisper.cpp" },
  { name: "whisper-rs", license: "MIT", url: "https://github.com/tazz4843/whisper-rs" },
  { name: "Tauri", license: "Apache-2.0 / MIT", url: "https://tauri.app" },
  { name: "cpal", license: "Apache-2.0", url: "https://github.com/RustAudio/cpal" },
  { name: "rusqlite", license: "MIT", url: "https://github.com/rusqlite/rusqlite" },
  { name: "React", license: "MIT", url: "https://react.dev" },
  { name: "Vite", license: "MIT", url: "https://vitejs.dev" },
  { name: "Recharts", license: "MIT", url: "https://recharts.org" },
  { name: "Zustand", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "Lucide React", license: "ISC", url: "https://lucide.dev" },
  { name: "Tailwind CSS", license: "MIT", url: "https://tailwindcss.com" },
];

const DIFFERENCES = [
  "100% local — no audio ever leaves your machine",
  "No team features or collaboration sync",
  "No mobile app — Windows desktop only",
  "No HIPAA or enterprise compliance certifications (personal-use software)",
  "No cloud-based style learning — style memory is purely local SQLite",
  "No subscription fee — completely free and open source",
];

export default function AboutPage() {
  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px", maxWidth: "680px" }}>
      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            🎙️
          </div>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fafafa", margin: 0 }}>
              FlowLocal
            </h1>
            <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>v0.1.0 · MIT License</p>
          </div>
        </div>
        <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: 1.7, margin: 0 }}>
          FlowLocal is a 100% local, privacy-first voice-to-text desktop app for Windows 11.
          Speak naturally — dictate emails, code, notes, and messages — and let AI clean up your
          transcript automatically. Everything runs on your hardware: no cloud, no API keys, no subscriptions.
        </p>
      </div>

      {/* Key features */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
        {[
          { icon: Lock, label: "Zero Cloud", desc: "All processing on-device" },
          { icon: Zap, label: "< 2s Latency", desc: "Fast local inference" },
          { icon: Cpu, label: "Intel Optimized", desc: "Vulkan backend for Arc" },
        ].map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            style={{
              background: "#111",
              border: "1px solid #1f1f1f",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <Icon size={18} style={{ color: "#7c3aed" }} />
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>{label}</div>
            <div style={{ fontSize: "12px", color: "#71717a" }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Differences from Wispr Flow */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
          Differences from Wispr Flow
        </h2>
        <div
          style={{
            background: "#111",
            border: "1px solid #1f1f1f",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {DIFFERENCES.map((diff, i) => (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                borderBottom: i < DIFFERENCES.length - 1 ? "1px solid #1a1a1a" : "none",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              <span style={{ color: "#52525b", fontSize: "12px", flexShrink: 0 }}>→</span>
              <span style={{ fontSize: "13px", color: "#a1a1aa" }}>{diff}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dependencies */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
          Open Source Dependencies
        </h2>
        <div
          style={{
            background: "#111",
            border: "1px solid #1f1f1f",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {DEPS.map((dep, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                borderBottom: i < DEPS.length - 1 ? "1px solid #1a1a1a" : "none",
              }}
            >
              <a
                href={dep.url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "none")}
              >
                {dep.name}
              </a>
              <span
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "11px",
                  color: "#71717a",
                  fontFamily: "monospace",
                }}
              >
                {dep.license}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          color: "#52525b",
        }}
      >
        <span>Built with</span>
        <Heart size={12} style={{ color: "#7c3aed" }} />
        <span>using Tauri + Rust + React · </span>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#71717a", display: "flex", alignItems: "center", gap: "4px" }}
        >
          <ExternalLink size={12} />
          View Source
        </a>
      </div>
    </div>
  );
}
