import { useEffect, useState } from "react";
import { Globe, Keyboard, Mic, MonitorCheck, Shield, History } from "lucide-react";
import { listAudioDevices, setSetting, getSetting } from "../lib/ipc";
import { useAppStore } from "../lib/store";
import { Link } from "react-router-dom";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "auto", label: "Auto-detect" },
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
    <section style={{ marginBottom: 18 }}>
      <div className="section-label">{title}</div>
      <div className="table-panel">{children}</div>
    </section>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon?: React.ElementType;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {Icon && <Icon size={16} color="var(--secondary)" />}
        <div>
          <div className="setting-title">{label}</div>
          {description && <div className="setting-desc">{description}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button className={`switch ${checked ? "on" : ""}`} onClick={onChange} aria-pressed={checked}>
      <span />
    </button>
  );
}

export default function SettingsPage() {
  const { privacyMode, togglePrivacy, language, setLanguage } = useAppStore();
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [saveHistory, setSaveHistory] = useState(true);
  
  // Custom Dynamic Shortcuts Settings State
  const [shortcutToggle, setShortcutToggle] = useState("Ctrl+Alt");
  const [keybindKeyboardName, setKeybindKeyboardName] = useState("Ctrl+Q");
  const [keybindKeyboardMode, setKeybindKeyboardMode] = useState("hold");
  const [keybindMouseName, setKeybindMouseName] = useState("Middle Click");
  const [keybindMouseMode, setKeybindMouseMode] = useState("hold");

  useEffect(() => {
    listAudioDevices()
      .then((devs) => {
        setDevices(devs);
        if (devs.length > 0) setSelectedDevice(devs[0]);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const toggle = await getSetting("shortcut_toggle");
      if (toggle) setShortcutToggle(toggle);

      const saveHist = await getSetting("save_history");
      if (saveHist) setSaveHistory(saveHist === "true");

      const kbName = await getSetting("keybind_keyboard_name");
      const kbMode = await getSetting("keybind_keyboard_mode");
      const kbOld = await getSetting("keybind_keyboard");

      if (kbName) {
        setKeybindKeyboardName(kbName);
      } else if (kbOld) {
        const mapping: Record<string, string> = {
          rshift_ralt: "Right Alt",
          rshift_double: "Right Shift",
          ralt_hold: "Right Alt",
          caps_hold: "Caps Lock",
          tilde_hold: "Tilde (~)",
        };
        setKeybindKeyboardName(mapping[kbOld] ?? "Right Alt");
      } else {
        setKeybindKeyboardName("Ctrl+Q");
      }

      if (kbMode) {
        setKeybindKeyboardMode(kbMode);
      } else if (kbOld) {
        setKeybindKeyboardMode(kbOld.includes("double") || kbOld === "rshift_ralt" ? "double_tap" : "hold");
      } else {
        setKeybindKeyboardMode("hold");
      }

      const mouse = await getSetting("keybind_mouse");
      const mouseName = await getSetting("keybind_mouse_name");
      const mouseMode = await getSetting("keybind_mouse_mode");
      
      if (mouseName) {
        setKeybindMouseName(mouseName);
      } else if (mouse && mouse !== "none") {
        const mapping: Record<string, string> = {
          middle: "Middle Click",
          back: "Mouse Button 4",
          forward: "Mouse Button 5",
          right: "Right Click",
        };
        setKeybindMouseName(mapping[mouse] ?? "Middle Click");
      } else if (mouse === "none") {
        setKeybindMouseName("Disabled");
      } else {
        setKeybindMouseName("Middle Click");
      }
      if (mouseMode) setKeybindMouseMode(mouseMode);
    };
    loadSettings().catch(console.error);
  }, []);

  const save = async (key: string, value: string) => setSetting(key, value).catch(console.error);

  const keyboardModeLabel = {
    hold: "Hold-to-talk",
    toggle: "Tap-to-toggle",
    double_tap: "Double-tap"
  }[keybindKeyboardMode] ?? "Hold-to-talk";

  return (
    <div className="page narrow">
      <div className="page-header">
        <div>
          <p className="page-kicker">Preferences</p>
          <h2 className="page-title">Settings</h2>
        </div>
      </div>

      <Section title="Audio input">
        <SettingRow icon={Mic} label="Microphone" description="Preferred input device">
          <select
            className="select"
            style={{ width: 260 }}
            value={selectedDevice}
            onChange={(e) => {
              setSelectedDevice(e.target.value);
              save("mic_device", e.target.value);
            }}
          >
            {devices.length === 0 && <option value="">No devices found</option>}
            {devices.map((device) => (
              <option key={device} value={device}>
                {device}
              </option>
            ))}
          </select>
        </SettingRow>
      </Section>

      <Section title="Language and transcription">
        <SettingRow icon={Globe} label="Default language" description="Use Auto for multilingual dictation">
          <select className="select" style={{ width: 260 }} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </SettingRow>
      </Section>

      <Section title="Privacy">
        <SettingRow icon={Shield} label="Privacy mode" description="Temporary private session: do not store transcripts in local history">
          <Switch checked={privacyMode} onChange={togglePrivacy} />
        </SettingRow>
        <SettingRow icon={History} label="Save dictation history" description="Permanently save transcripts to local SQLite database">
          <Switch
            checked={saveHistory}
            onChange={() => {
              const next = !saveHistory;
              setSaveHistory(next);
              save("save_history", next ? "true" : "false");
            }}
          />
        </SettingRow>
      </Section>

      <Section title="Triggers">
        <SettingRow icon={MonitorCheck} label="Toggle dictation" description="Press once to start, press again to stop.">
          <span className="keycap">{shortcutToggle}</span>
        </SettingRow>
        <SettingRow icon={Keyboard} label="Instant dictation" description="Hold key to talk, release key to transcribe.">
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {keybindKeyboardName} ({keyboardModeLabel})
          </span>
        </SettingRow>
        <SettingRow label="Mouse trigger" description="Optional mouse trigger button">
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {keybindMouseName !== "Disabled" ? `${keybindMouseName} (${keybindMouseMode === "hold" ? "Hold-to-talk" : "Tap-to-toggle"})` : "Disabled"}
          </span>
        </SettingRow>
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--separator-soft)", display: "flex", justifyContent: "flex-end" }}>
          <Link to="/shortcuts" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            Change Shortcuts & Triggers →
          </Link>
        </div>
      </Section>

      <section className="glass-panel mac-callout">
        <Shield size={16} color="var(--success)" />
        <p className="row-desc" style={{ margin: 0 }}>
          LocalFlow has no telemetry or analytics. Audio and transcripts stay on this machine.
        </p>
      </section>
    </div>
  );
}
