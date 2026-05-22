import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  StickyNote,
  History,
  BookOpen,
  Keyboard,
  Download,
  Settings,
  Info,
  Shield,
  Mic,
} from "lucide-react";
import { useEffect } from "react";
import { useAppStore } from "./lib/store";

// Route pages
import Dashboard from "./routes/Dashboard";
import HistoryPage from "./routes/History";
import DictionaryPage from "./routes/Dictionary";
import ModelsPage from "./routes/Models";
import SettingsPage from "./routes/Settings";
import ShortcutsPage from "./routes/Shortcuts";
import NotesPage from "./routes/Notes";
import AboutPage from "./routes/About";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/notes", icon: StickyNote, label: "Notes" },
  { to: "/history", icon: History, label: "History" },
  { to: "/dictionary", icon: BookOpen, label: "Dictionary" },
  { to: "/shortcuts", icon: Keyboard, label: "Shortcuts" },
  { to: "/models", icon: Download, label: "Models" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/about", icon: Info, label: "About" },
];

export default function App() {
  const location = useLocation();
  const { isRecording, isProcessing, privacyMode, initListeners } = useAppStore();

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    initListeners().then((fn) => {
      cleanup = fn;
    });
    return () => {
      cleanup?.();
    };
  }, [initListeners]);

  // Status: red=recording, amber=processing, green=idle
  const statusColor = isRecording
    ? "#ef4444"
    : isProcessing
    ? "#f59e0b"
    : "#22c55e";

  const statusLabel = isRecording
    ? "Recording"
    : isProcessing
    ? "Processing"
    : "Ready";

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#0a0a0a",
        color: "#fafafa",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: "210px",
          flexShrink: 0,
          borderRight: "1px solid #1a1a1a",
          display: "flex",
          flexDirection: "column",
          background: "#080808",
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: "56px",
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            borderBottom: "1px solid #1a1a1a",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Mic size={14} style={{ color: "#fff" }} />
          </div>
          <span
            style={{
              fontSize: "15px",
              fontWeight: 700,
              background: "linear-gradient(90deg, #a78bfa, #7c3aed)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.01em",
            }}
          >
            FlowLocal
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "10px",
              color: "#3f3f46",
              fontFamily: "monospace",
            }}
          >
            v0.1
          </span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px", overflowY: "auto" }}>
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive =
              to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  marginBottom: "2px",
                  textDecoration: "none",
                  color: isActive ? "#fafafa" : "#71717a",
                  background: isActive ? "#1a1a2e" : "transparent",
                  transition: "background 0.1s, color 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "#141420";
                    (e.currentTarget as HTMLAnchorElement).style.color = "#d4d4d8";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.color = "#71717a";
                  }
                }}
              >
                <Icon
                  size={15}
                  style={{ color: isActive ? "#a78bfa" : "#52525b", flexShrink: 0 }}
                />
                {label}
              </NavLink>
            );
          })}
        </nav>

        {/* Status footer */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid #1a1a1a",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Status indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: statusColor,
                boxShadow: `0 0 6px ${statusColor}80`,
                animation: isRecording ? "pulse 1s infinite" : "none",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "12px", color: "#52525b" }}>{statusLabel}</span>
            {privacyMode && (
              <Shield
                size={12}
                style={{ color: "#f59e0b", marginLeft: "auto" }}
              />
            )}
          </div>

          {/* Shortcut hint */}
          <div style={{ fontSize: "11px", color: "#3f3f46" }}>
            Toggle:{" "}
            <span style={{ fontFamily: "monospace", color: "#52525b" }}>
              Ctrl+Shift+Space
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/shortcuts" element={<ShortcutsPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; }
        a { color: inherit; }
        input, textarea, select { color-scheme: dark; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }
      `}</style>
    </div>
  );
}
