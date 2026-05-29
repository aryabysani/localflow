import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import logoIcon from "../assets/brand/logo_icon.png";
import logoWhite from "../assets/brand/logo_white.png";

/**
 * MicBubble — Borderless, backgroundless floating widget.
 * Coordinates are mapped within a static 240x40 transparent Tauri window.
 *
 * Idle  → Logo sits at the right side (centered in a virtual 40x40 area).
 * Active → Logo slides smoothly to the left (128px from the right),
 *          and the live voice frequency meter fades in exactly where the logo was.
 * Done  → Logo slides further to the left (208px from the right),
 *          and the transcribed text fades in next to it.
 */
export default function MicBubble() {
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "command" | "done">("idle");
  const [bars, setBars] = useState<number[]>(Array(8).fill(0.1));
  const [transcribedText, setTranscribedText] = useState("");
  const [isError, setIsError] = useState(false);
  const ampRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Lifecycle & Listeners ──────────────────────────────────── */
  useEffect(() => {
    document.body.style.background = "transparent";
    document.body.style.overflow   = "hidden";
    document.body.style.margin     = "0";

    const checkInitial = async () => {
      try {
        const isRec = await invoke<boolean>("is_recording");
        if (isRec) setStatus("recording");
      } catch { /* ignore */ }
    };
    checkInitial();

    return () => { document.body.style.background = ""; };
  }, []);

  // Done auto-collapse sequence
  useEffect(() => {
    if (status === "done") {
      const id = setTimeout(() => {
        setStatus("idle");
        setTranscribedText("");
        setIsError(false);
      }, 2500);
      return () => clearTimeout(id);
    }
  }, [status]);

  // Audio level polling & state listeners
  useEffect(() => {
    ampRef.current = setInterval(async () => {
      try {
        const a = await invoke<{ rms: number; bars: number[] }>("get_amplitude");
        if (a?.bars?.length) {
          setBars(a.bars.slice(0, 8));
        } else {
          setBars(Array(8).fill(0).map(() => 0.05 + Math.random() * 0.1));
        }
      } catch {
        setBars(Array(8).fill(0).map(() => 0.05 + Math.random() * 0.1));
      }
    }, 100);

    const u1 = listen("recording-started", () => {
      setTranscribedText("");
      setIsError(false);
      setStatus("recording");
    });
    const u2 = listen("processing-started", () => setStatus("processing"));
    const u3 = listen("command-mode-started", () => {
      setTranscribedText("");
      setIsError(false);
      setStatus("command");
    });
    const u4 = listen<{ raw?: string; cleaned?: string; error?: string }>("processing-done", (ev) => {
      const p = ev.payload;
      if (p.error) {
        setTranscribedText(p.error === "Cancelled" ? "Cancelled" : `Error: ${p.error}`);
        setIsError(p.error !== "Cancelled");
      } else if (p.cleaned) {
        setTranscribedText(p.cleaned);
        setIsError(false);
      } else {
        setTranscribedText("");
        setIsError(false);
      }
      setStatus("done");
    });

    return () => {
      if (ampRef.current) clearInterval(ampRef.current);
      u1.then(f => f());
      u2.then(f => f());
      u3.then(f => f());
      u4.then(f => f());
    };
  }, []);

  /* ── Actions ────────────────────────────────────────────────── */
  const handleClick = async () => {
    if (status === "idle") {
      await invoke("start_recording_cmd").catch(console.error);
    } else if (status === "recording" || status === "command") {
      await invoke("stop_and_transcribe_cmd").catch(console.error);
    }
  };

  const isActive = status !== "idle";

  // Compute absolute positioning right offsets
  const logoRight =
    status === "done" ? 208
    : (status === "recording" || status === "processing" || status === "command") ? 128
    : 8; // idle centered position inside 40px bounding box

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "transparent",
        userSelect: "none",
        fontFamily: "'Inter', -apple-system, sans-serif",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* ─── Floating Logo ─── */}
      <div
        onClick={handleClick}
        style={{
          position: "absolute",
          right: `${logoRight}px`,
          bottom: "8px",
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "right 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          filter: "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.55))",
          pointerEvents: "auto",
          cursor: "pointer",
        }}
      >
        <img
          src={isActive ? logoWhite : logoIcon}
          alt="LocalFlow"
          style={{
            width: "20px",
            height: "20px",
            objectFit: "contain",
          }}
        />
      </div>

      {/* ─── Voice Frequency Meter (Speech Waveform) ─── */}
      <div
        onClick={handleClick}
        style={{
          position: "absolute",
          right: "8px",
          bottom: "10px",
          width: "112px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          gap: "2.5px",
          opacity: (status === "recording" || status === "command") ? 1 : 0,
          pointerEvents: (status === "recording" || status === "command") ? "auto" : "none",
          transition: "opacity 0.25s ease-in-out",
          filter: "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.55))",
          cursor: "pointer",
        }}
      >
        {bars.map((amp, i) => {
          const h = Math.max(3, amp * 18);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h}px`,
                borderRadius: "1px",
                background: status === "command"
                  ? "linear-gradient(180deg,#c084fc,#a78bfa)"
                  : "linear-gradient(180deg,#ffffff,#d4d4d8)",
                transition: "height 80ms ease-out",
              }}
            />
          );
        })}
      </div>

      {/* ─── Processing Text ─── */}
      <div
        onClick={handleClick}
        style={{
          position: "absolute",
          right: "8px",
          bottom: "10px",
          width: "112px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          opacity: status === "processing" ? 1 : 0,
          pointerEvents: status === "processing" ? "auto" : "none",
          transition: "opacity 0.25s ease-in-out",
          filter: "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.55))",
          cursor: "pointer",
        }}
      >
        <span style={{
          color: "rgba(255, 255, 255, 0.85)",
          fontSize: "11px",
          fontWeight: 600,
          animation: "shimmer 1.2s infinite alternate",
          whiteSpace: "nowrap",
        }}>
          Processing...
        </span>
      </div>

      {/* ─── Transcription Text (Done State - Success Only) ─── */}
      <div
        onClick={handleClick}
        style={{
          position: "absolute",
          right: "8px",
          bottom: "10px",
          width: "192px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          opacity: (status === "done" && !isError) ? 1 : 0,
          pointerEvents: (status === "done" && !isError) ? "auto" : "none",
          transition: "opacity 0.25s ease-in-out",
          filter: "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.55))",
          cursor: "pointer",
        }}
      >
        <span style={{
          color: "#e4e4e7",
          fontSize: "11px",
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          width: "100%",
        }}>
          {`"${transcribedText}"`}
        </span>
      </div>

      {/* ─── Full Error Message Callout (Displayed on Top) ─── */}
      {status === "done" && isError && (
        <div
          style={{
            position: "absolute",
            right: "8px",
            left: "8px",
            bottom: "38px",
            background: "rgba(22, 12, 12, 0.92)",
            border: "1px solid rgba(239, 68, 68, 0.45)",
            borderRadius: "6px",
            padding: "6px 10px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.55)",
            animation: "fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            zIndex: 10,
          }}
        >
          <span style={{
            color: "#fca5a5",
            fontSize: "10px",
            lineHeight: "14px",
            fontWeight: 500,
            wordBreak: "break-word",
          }}>
            {transcribedText}
          </span>
        </div>
      )}

      {/* Dynamic Keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
