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
} from "lucide-react";

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// Placeholder pages — will be built out in later steps
function Dashboard() {
  const [status, setStatus] = useState("Idle — Ready to dictate");
  const [isRecording, setIsRecording] = useState(false);

  const toggleRecording = async () => {
    try {
      if (isRecording) {
        setStatus("Stopping...");
        const data = await invoke<number[]>("stop_audio_capture");
        setStatus(`Captured ${data.length} samples`);
        setIsRecording(false);
      } else {
        setStatus("Starting...");
        await invoke("start_audio_capture");
        setStatus("Recording...");
        setIsRecording(true);
      }
    } catch (err) {
      setStatus(`Error: ${err}`);
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div className="flex items-center gap-3">
        <div
          className={`w-3 h-3 rounded-full ${
            isRecording ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
          }`}
        />
        <span className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          {status}
        </span>
      </div>
      <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
        FlowLocal
      </h1>
      <p className="text-muted-foreground text-center max-w-md leading-relaxed">
        100% local voice-to-text. Press{" "}
        <kbd className="px-2 py-0.5 rounded bg-muted border border-border font-mono text-xs">
          Right Alt
        </kbd>{" "}
        to start dictating anywhere.
      </p>
      <button
        onClick={toggleRecording}
        className="mt-4 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
      >
        {isRecording ? "Stop Audio Capture" : "Test Audio Capture"}
      </button>
    </div>
  );
}

function NotesPage() {
  return <PageShell title="Notes" />;
}
function HistoryPage() {
  return <PageShell title="History" />;
}
function DictionaryPage() {
  return <PageShell title="Dictionary" />;
}
function ShortcutsPage() {
  return <PageShell title="Shortcuts" />;
}
function ModelsPage() {
  return <PageShell title="Models" />;
}
function SettingsPage() {
  return <PageShell title="Settings" />;
}
function AboutPage() {
  return <PageShell title="About" />;
}

function PageShell({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Coming in a later build step.
      </p>
    </div>
  );
}

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border flex flex-col bg-sidebar-background">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border">
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            FlowLocal
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
            v0.1.0
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive =
              to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        {/* Status indicator */}
        <div className="px-5 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
            <span className="text-xs text-muted-foreground">Ready</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
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
    </div>
  );
}
