import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  Download,
  History,
  Info,
  Keyboard,
  LayoutDashboard,
  Mic,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";
import { useAppStore } from "./lib/store";

import AboutPage from "./routes/About";
import Dashboard from "./routes/Dashboard";
import DictionaryPage from "./routes/Dictionary";
import HistoryPage from "./routes/History";
import ModelsPage from "./routes/Models";
import SettingsPage from "./routes/Settings";
import ShortcutsPage from "./routes/Shortcuts";
import LLMSettingsPage from "./routes/LLMSettings";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/history", icon: History, label: "History" },
  { to: "/dictionary", icon: BookOpen, label: "Dictionary" },
  { to: "/shortcuts", icon: Keyboard, label: "Shortcuts" },
  { to: "/models", icon: Download, label: "Models" },
  { to: "/llm", icon: Sparkles, label: "Local LLM" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/about", icon: Info, label: "About" },
];

function titleForPath(pathname: string) {
  if (pathname.startsWith("/history")) return ["History", "Recent dictations and transcripts"];
  if (pathname.startsWith("/dictionary")) return ["Dictionary", "Vocabulary hints for Whisper"];
  if (pathname.startsWith("/shortcuts")) return ["Shortcuts", "Keyboard and mouse triggers"];
  if (pathname.startsWith("/models")) return ["Models", "Local speech recognition models"];
  if (pathname.startsWith("/llm")) return ["Local LLM", "Offline text formatting and cleanup"];
  if (pathname.startsWith("/settings")) return ["Settings", "Preferences for local dictation"];
  if (pathname.startsWith("/about")) return ["About", "Privacy-first voice to text"];
  return ["Dashboard", "Voice productivity at a glance"];
}

export default function App() {
  const location = useLocation();
  const { isRecording, isProcessing, privacyMode, initListeners } = useAppStore();
  const [title, subtitle] = titleForPath(location.pathname);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    initListeners().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [initListeners]);

  const statusLabel = isRecording ? "Recording" : isProcessing ? "Processing" : "Ready";
  const statusClass = isRecording ? "recording" : isProcessing ? "processing" : "";

  return (
    <div className="mac-window">
      <aside className="mac-sidebar">


        <div className="brand-lockup">
          <div className="brand-icon">
            <Mic size={16} strokeWidth={2.2} />
          </div>
          <div className="brand-title">
            <strong>FlowLocal</strong>
            <span>On-device dictation</span>
          </div>
        </div>

        <nav className="source-list" aria-label="Primary">
          <div className="source-section-label">Library</div>
          {navItems.slice(0, 3).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `source-item ${isActive ? "active" : ""}`}
              end={to === "/"}
            >
              <Icon strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="source-section-label">Preferences</div>
          {navItems.slice(3).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `source-item ${isActive ? "active" : ""}`}
            >
              <Icon strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-pill">
            <span className={`status-light ${statusClass}`} />
            <span>{statusLabel}</span>
            {privacyMode && <Shield size={14} color="var(--warning)" style={{ marginLeft: "auto" }} />}
          </div>
          <div style={{ marginTop: 8 }}>
            <span className="keycap">Ctrl Shift Space</span>
          </div>
        </div>
      </aside>

      <section className="mac-main">
        <header className="mac-titlebar">
          <div className="titlebar-title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="titlebar-actions">
            <span className="badge">Local only</span>
          </div>
        </header>

        <main className="page-scroll">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/dictionary" element={<DictionaryPage />} />
            <Route path="/shortcuts" element={<ShortcutsPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/llm" element={<LLMSettingsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
      </section>
    </div>
  );
}
