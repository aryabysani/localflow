import { useEffect, useState } from "react";
import { setSetting, listAudioDevices } from "../lib/ipc";
import { useAppStore } from "../lib/store";
import { Mic, Globe, Shield, MonitorCheck } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "auto", label: "Auto-detect (multilingual)" },
  { code: "zh", label: "Chinese" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "it", label: "Italian" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "nl", label: "Dutch" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
        {title}
      </h2>
      <div
        style={{
          background: "#111",
          border: "1px solid #1f1f1f",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
  last,
}: {
  icon?: React.ElementType;
  label: string;
  description?: string;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        borderBottom: last ? "none" : "1px solid #1a1a1a",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
        {Icon && <Icon size={16} style={{ color: "#71717a", flexShrink: 0 }} />}
        <div>
          <div style={{ fontSize: "14px", color: "#fafafa", fontWeight: 500 }}>{label}</div>
          {description && <div style={{ fontSize: "12px", color: "#52525b", marginTop: "2px" }}>{description}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: "44px",
        height: "24px",
        borderRadius: "12px",
        background: checked ? "#7c3aed" : "#2a2a2a",
        cursor: "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
        position: "relative",
      }}
    >
      <div
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#fafafa",
          position: "absolute",
          top: "3px",
          left: checked ? "23px" : "3px",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { privacyMode, togglePrivacy, language, setLanguage } = useAppStore();
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");

  useEffect(() => {
    listAudioDevices()
      .then((devs) => {
        setDevices(devs);
        if (devs.length > 0) setSelectedDevice(devs[0]);
      })
      .catch(console.error);
  }, []);

  const saveSetting = async (key: string, value: string) => {
    await setSetting(key, value);
  };

  const selectStyle = {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "#fafafa",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px", maxWidth: "680px" }}>
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fafafa", margin: 0 }}>Settings</h1>
        <p style={{ fontSize: "13px", color: "#71717a", margin: "4px 0 0" }}>
          Configure FlowLocal to work exactly the way you want.
        </p>
      </div>

      {/* Audio */}
      <Section title="Audio Input">
        <SettingRow
          icon={Mic}
          label="Microphone"
          description="Select your preferred input device"
        >
          <select
            value={selectedDevice}
            onChange={(e) => {
              setSelectedDevice(e.target.value);
              saveSetting("mic_device", e.target.value);
            }}
            style={{ ...selectStyle, minWidth: "200px" }}
          >
            {devices.length === 0 && (
              <option value="">No devices found</option>
            )}
            {devices.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </SettingRow>
      </Section>

      {/* Language */}
      <Section title="Language & Transcription">
        <SettingRow
          icon={Globe}
          label="Default Language"
          description="Language for speech recognition. Use Auto for multilingual or Hinglish."
        >
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ ...selectStyle, minWidth: "220px" }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </SettingRow>
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <SettingRow
          icon={Shield}
          label="Privacy Mode"
          description="When enabled, transcripts are not stored to disk. Audio is zeroed in RAM after each use."
          last
        >
          <Toggle checked={privacyMode} onChange={() => togglePrivacy()} />
        </SettingRow>
      </Section>

      {/* Hotkeys info */}
      <Section title="Hotkeys">
        <SettingRow
          icon={MonitorCheck}
          label="Toggle Dictation"
          description="Press and hold to dictate, release to transcribe"
          last={false}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontFamily: "monospace",
              color: "#a78bfa",
            }}
          >
            Ctrl+Shift+Space
          </div>
        </SettingRow>
        <SettingRow
          label="Push-to-Talk (hold)"
          description="Hold to record from frontend button, release to transcribe"
          last
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontFamily: "monospace",
              color: "#a78bfa",
            }}
          >
            Right Alt (coming soon)
          </div>
        </SettingRow>
      </Section>

      {/* Telemetry notice */}
      <div
        style={{
          background: "#0a1a0a",
          border: "1px solid #1a3a1a",
          borderRadius: "10px",
          padding: "14px 18px",
          fontSize: "13px",
          color: "#86efac",
          lineHeight: 1.6,
        }}
      >
        🔒 <strong>Zero telemetry.</strong> FlowLocal never sends any data anywhere. No analytics, no crash
        reporting, no usage tracking. Your voice stays on your machine, always.
      </div>
    </div>
  );
}
