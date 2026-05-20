import { useEffect, useState } from "react";

/**
 * MicBubble — Floating overlay window shown during recording.
 * 280×80 px rounded pill with:
 *  - Live waveform bars (8 bars, animated with random amplitudes for now)
 *  - Timer (mm:ss)
 *  - "Release to send" hint text
 *
 * This component renders in the `bubble` Tauri window which is
 * transparent, always-on-top, undecorated, and skip-taskbar.
 */
export default function MicBubble() {
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(8).fill(0.3));

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulated waveform animation (will be wired to real audio later)
  useEffect(() => {
    const interval = setInterval(() => {
      setBars(
        Array(8)
          .fill(0)
          .map(() => 0.15 + Math.random() * 0.85),
      );
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div
      style={{
        width: "280px",
        height: "80px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        background: "rgba(10, 10, 10, 0.92)",
        borderRadius: "40px",
        border: "1px solid rgba(124, 58, 237, 0.3)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(124, 58, 237, 0.15)",
        backdropFilter: "blur(20px)",
        padding: "0 20px",
        fontFamily: "'Inter', sans-serif",
        overflow: "hidden",
        userSelect: "none",
        // @ts-expect-error WebkitAppRegion is a non-standard CSS property for Tauri draggable windows
        WebkitAppRegion: "drag",
      }}
    >
      {/* Recording indicator dot */}
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: "#ef4444",
          boxShadow: "0 0 8px rgba(239, 68, 68, 0.6)",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />

      {/* Waveform bars */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "3px",
          height: "36px",
        }}
      >
        {bars.map((amplitude, i) => (
          <div
            key={i}
            style={{
              width: "3px",
              height: `${amplitude * 36}px`,
              backgroundColor: "#7c3aed",
              borderRadius: "2px",
              transition: "height 80ms ease-out",
              opacity: 0.7 + amplitude * 0.3,
            }}
          />
        ))}
      </div>

      {/* Timer */}
      <span
        style={{
          color: "#fafafa",
          fontSize: "14px",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
          letterSpacing: "0.02em",
          minWidth: "42px",
        }}
      >
        {minutes}:{seconds}
      </span>

      {/* Hint text */}
      <span
        style={{
          color: "#a1a1aa",
          fontSize: "11px",
          fontWeight: 400,
          whiteSpace: "nowrap",
        }}
      >
        Release to send
      </span>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
