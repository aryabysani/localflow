import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { getDashboardStats, DashboardStats } from "../lib/ipc";
import { useAppStore } from "../lib/store";

// Stat card component
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #1f1f1f",
        borderRadius: "12px",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        flex: 1,
        minWidth: "140px",
      }}
    >
      <span style={{ fontSize: "12px", color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "32px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: accent ? "#7c3aed" : "#fafafa",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: "12px", color: "#52525b" }}>{sub}</span>}
    </div>
  );
}

// Challenge ring
function ChallengeRing({ wordsToday, goal = 100 }: { wordsToday: number; goal?: number }) {
  const pct = Math.min(wordsToday / goal, 1);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #1f1f1f",
        borderRadius: "12px",
        padding: "24px",
        display: "flex",
        alignItems: "center",
        gap: "24px",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={128} height={128} viewBox="0 0 128 128">
          <circle cx={64} cy={64} r={r} fill="none" stroke="#1f1f1f" strokeWidth={8} />
          <circle
            cx={64}
            cy={64}
            r={r}
            fill="none"
            stroke="#7c3aed"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 64 64)"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "22px", fontWeight: 700, color: "#fafafa" }}>
            {Math.round(pct * 100)}%
          </span>
          <span style={{ fontSize: "10px", color: "#71717a" }}>of goal</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "16px", fontWeight: 600, color: "#fafafa" }}>
          100 Words/Day Challenge
        </span>
        <span style={{ fontSize: "13px", color: "#71717a" }}>
          {wordsToday} / {goal} words today
        </span>
        <div
          style={{
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              background: "#7c3aed20",
              border: "1px solid #7c3aed40",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              color: "#a78bfa",
            }}
          >
            {wordsToday >= goal ? "🎉 Goal achieved!" : `${goal - wordsToday} words to go`}
          </div>
        </div>
      </div>
    </div>
  );
}

const ACCENT_COLORS = ["#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#3b0764", "#2e1065", "#1e0a4a", "#0f0533"];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { isRecording, isProcessing, lastTranscript, startRecording, stopRecording } = useAppStore();

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lastTranscript]); // Refresh after dictation

  const formatMinutes = (m: number) => {
    if (m < 60) return `${Math.round(m)} min`;
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return `${h}h ${min}m`;
  };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fafafa", margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: "13px", color: "#71717a", margin: "4px 0 0" }}>
            Your voice productivity at a glance
          </p>
        </div>
        {/* Quick record button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            background: isRecording ? "#ef444415" : "#7c3aed",
            border: isRecording ? "1px solid #ef4444" : "1px solid #7c3aed",
            borderRadius: "8px",
            color: isRecording ? "#ef4444" : "#fafafa",
            fontSize: "14px",
            fontWeight: 500,
            cursor: isProcessing ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: isRecording ? "#ef4444" : "#fafafa",
              animation: isRecording ? "pulse 1s infinite" : "none",
            }}
          />
          {isProcessing ? "Processing…" : isRecording ? "Stop Recording" : "Test Dictation"}
        </button>
      </div>

      {/* Last transcript preview */}
      {lastTranscript && (
        <div
          style={{
            background: "#0f0f1a",
            border: "1px solid #7c3aed30",
            borderRadius: "10px",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#7c3aed", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
            Last Dictation
          </div>
          <p style={{ fontSize: "14px", color: "#e4e4e7", margin: 0, lineHeight: 1.6 }}>
            {lastTranscript.cleaned}
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <StatCard
          label="Total Words"
          value={(stats?.total_words ?? 0).toLocaleString()}
          sub="lifetime dictated"
          accent
        />
        <StatCard
          label="Words Today"
          value={(stats?.words_today ?? 0).toLocaleString()}
          sub={new Date().toLocaleDateString("en-IN", { weekday: "long" })}
        />
        <StatCard
          label="Avg WPM"
          value={Math.round(stats?.avg_wpm_7d ?? 0)}
          sub="last 7 days"
        />
        <StatCard
          label="Streak"
          value={`${stats?.streak_days ?? 0}d`}
          sub="days with ≥100 words"
        />
      </div>

      {/* Challenge ring + time saved */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <ChallengeRing wordsToday={stats?.words_today ?? 0} />
        <div
          style={{
            background: "#111",
            border: "1px solid #1f1f1f",
            borderRadius: "12px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Time Saved
          </span>
          <span style={{ fontSize: "40px", fontWeight: 700, color: "#22d3ee", letterSpacing: "-0.02em" }}>
            {formatMinutes(stats?.time_saved_minutes ?? 0)}
          </span>
          <span style={{ fontSize: "13px", color: "#52525b" }}>
            vs. typing at 60 WPM · {(stats?.total_dictations ?? 0).toLocaleString()} dictations total
          </span>
        </div>
      </div>

      {/* WPM line chart */}
      {stats && stats.words_per_day.length > 0 && (
        <div
          style={{
            background: "#111",
            border: "1px solid #1f1f1f",
            borderRadius: "12px",
            padding: "20px 24px",
          }}
        >
          <div style={{ fontSize: "13px", color: "#a1a1aa", marginBottom: "16px", fontWeight: 500 }}>
            Words per Day — last 30 days
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={stats.words_per_day}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#52525b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10, fill: "#52525b" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "#a1a1aa" }}
                itemStyle={{ color: "#7c3aed" }}
              />
              <Line
                type="monotone"
                dataKey="words"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#7c3aed" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top apps */}
      {stats && stats.top_apps.length > 0 && (
        <div
          style={{
            background: "#111",
            border: "1px solid #1f1f1f",
            borderRadius: "12px",
            padding: "20px 24px",
          }}
        >
          <div style={{ fontSize: "13px", color: "#a1a1aa", marginBottom: "16px", fontWeight: 500 }}>
            Top Apps by Words Dictated
          </div>
          <ResponsiveContainer width="100%" height={Math.min(stats.top_apps.length * 36 + 10, 220)}>
            <BarChart data={stats.top_apps} layout="vertical" barSize={16}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="app_name"
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Bar dataKey="word_count" radius={[0, 4, 4, 0]}>
                {stats.top_apps.map((_, index) => (
                  <Cell key={index} fill={ACCENT_COLORS[index % ACCENT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state */}
      {!loading && stats && stats.total_dictations === 0 && (
        <div
          style={{
            background: "#0a0a0a",
            border: "1px dashed #2a2a2a",
            borderRadius: "12px",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🎙️</div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#fafafa", margin: "0 0 8px" }}>
            Start Dictating
          </h3>
          <p style={{ fontSize: "14px", color: "#71717a", margin: 0 }}>
            Press <kbd style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "4px", padding: "2px 6px", fontFamily: "monospace" }}>Ctrl+Shift+Space</kbd> anywhere to begin.
            Your stats will appear here.
          </p>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
