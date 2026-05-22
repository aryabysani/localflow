import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * MicBubble — Floating overlay window shown during recording.
 * 320×88 px rounded pill with:
 *  - Live waveform bars (8 bars, wired to real audio amplitude via polling)
 *  - Timer (mm:ss)
 *  - Recording status / processing status
 *
 * Runs in the `bubble` Tauri window: transparent, always-on-top, undecorated, click-through.
 */
export default function MicBubble() {
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(8).fill(0.15));
  const [status, setStatus] = useState<"recording" | "processing">("recording");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const amplitudeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Poll amplitude from Rust at 10fps
    amplitudeRef.current = setInterval(async () => {
      try {
        const amp = await invoke<{ rms: number; bars: number[] }>("get_amplitude");
        if (amp && amp.bars.length > 0) {
          setBars(amp.bars);
        } else {
          // Animate randomly when no real data
          setBars(Array(8).fill(0).map(() => 0.1 + Math.random() * 0.7));
        }
      } catch {
        setBars(Array(8).fill(0).map(() => 0.1 + Math.random() * 0.5));
      }
    }, 100);

    // Listen for state changes from backend
    const unlistenRec = listen("recording-started", () => setStatus("recording"));
    const unlistenProc = listen("processing-started", () => setStatus("processing"));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (amplitudeRef.current) clearInterval(amplitudeRef.current);
      unlistenRec.then((fn) => fn());
      unlistenProc.then((fn) => fn());
    };
  }, []);

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div
      style={{
        width: "320px",
        height: "88px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        background: "rgba(8, 8, 8, 0.94)",
        borderRadius: "44px",
        border: "1px solid rgba(124, 58, 237, 0.35)",
        boxShadow:
          "0 12px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(124, 58, 237, 0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        padding: "0 22px",
        fontFamily: "'Inter', sans-serif",
        overflow: "hidden",
        userSelect: "none",
        // Draggable region for Tauri
        // @ts-expect-error non-standard prop
        WebkitAppRegion: "drag",
      }}
    >
      {/* Status indicator */}
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: status === "recording" ? "#ef4444" : "#f59e0b",
          boxShadow:
            status === "recording"
              ? "0 0 10px rgba(239, 68, 68, 0.7)"
              : "0 0 10px rgba(245, 158, 11, 0.7)",
          animation: "pulse 1.2s ease-in-out infinite",
          flexShrink: 0,
        }}
      />

      {/* Waveform bars */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "3px",
          height: "40px",
          flex: 1,
        }}
      >
        {bars.map((amplitude, i) => {
          // Center bars taller, outer bars shorter
          const centerBias = 1 - Math.abs(i - 3.5) / 4;
          const h = Math.max(4, amplitude * 40 * (0.5 + centerBias * 0.5));
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h}px`,
                background: `linear-gradient(180deg, #a78bfa, #7c3aed)`,
                borderRadius: "2px",
                transition: "height 80ms ease-out",
                opacity: 0.6 + amplitude * 0.4,
              }}
            />
          );
        })}
      </div>

      {/* Timer */}
      <span
        style={{
          color: "#fafafa",
          fontSize: "15px",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          letterSpacing: "0.02em",
          minWidth: "46px",
          flexShrink: 0,
        }}
      >
        {minutes}:{seconds}
      </span>

      {/* Hint */}
      <span
        style={{
          color: "#52525b",
          fontSize: "11px",
          fontWeight: 400,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {status === "processing" ? "Processing…" : "Release key"}
      </span>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
