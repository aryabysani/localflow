import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";

/* ─── Constants ───────────────────────────────────────────────────── */
const IDLE_W   = 56;
const IDLE_H   = 36;
const ACTIVE_W = 280;
const ACTIVE_H = 64;
const MARGIN   = 40;   // ~1 cm at 96 dpi

/**
 * MicBubble — Always-visible floating "liquid glass pebble" overlay.
 *
 * Idle  → tiny frosted-glass pill with a mic icon (56 × 36).
 * Active → expands to a wider pill with waveform + timer (280 × 64).
 * Done  → shows transcribed text for 2.5 s, then shrinks back.
 */
export default function MicBubble() {
  const [elapsed, setElapsed]             = useState(0);
  const [bars, setBars]                   = useState<number[]>(Array(8).fill(0.15));
  const [status, setStatus]               = useState<"idle"|"recording"|"processing"|"command"|"done">("idle");
  const [transcribedText, setTranscribedText] = useState("");
  const [isError, setIsError]             = useState(false);
  const ampRef = useRef<ReturnType<typeof setInterval>|null>(null);

  /* ── helpers ─────────────────────────────────────────────────── */

  /** Resize + reposition the native window to hug the pill tightly. */
  const syncWindowSize = useCallback(async (w: number, h: number) => {
    try {
      const win = getCurrentWindow();

      // Get monitor info for bottom-right positioning
      const monitor = await currentMonitor();
      if (monitor) {
        const sf   = monitor.scaleFactor;
        const mw   = monitor.size.width  / sf;      // logical width
        const mh   = monitor.size.height / sf;      // logical height
        const mx   = monitor.position.x  / sf;
        const my   = monitor.position.y  / sf;

        const x = mx + mw - w - MARGIN;
        const y = my + mh - h - MARGIN;

        await win.setSize(new LogicalSize(w, h));
        await win.setPosition(new LogicalPosition(x, y));
      } else {
        await win.setSize(new LogicalSize(w, h));
      }
    } catch (e) {
      console.error("syncWindowSize:", e);
    }
  }, []);

  /* ── lifecycle ───────────────────────────────────────────────── */

  // Transparent body
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

  // Resize window whenever status changes between idle ↔ active
  useEffect(() => {
    if (status === "idle") {
      syncWindowSize(IDLE_W, IDLE_H);
    } else {
      syncWindowSize(ACTIVE_W, ACTIVE_H);
    }
  }, [status, syncWindowSize]);

  // Elapsed timer
  useEffect(() => {
    let t: ReturnType<typeof setInterval>|null = null;
    if (status === "recording" || status === "command") {
      setElapsed(0);
      t = setInterval(() => setElapsed(p => p + 1), 1000);
    }
    return () => { if (t) clearInterval(t); };
  }, [status]);

  // Collapse back to idle after showing result
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

  // Backend event listeners + amplitude polling
  useEffect(() => {
    ampRef.current = setInterval(async () => {
      try {
        const a = await invoke<{rms:number;bars:number[]}>("get_amplitude");
        if (a?.bars?.length) setBars(a.bars);
        else setBars(Array(8).fill(0).map(()=>0.1+Math.random()*0.7));
      } catch { setBars(Array(8).fill(0).map(()=>0.1+Math.random()*0.5)); }
    }, 100);

    const u1 = listen("recording-started",     () => { setTranscribedText(""); setIsError(false); setStatus("recording"); });
    const u2 = listen("processing-started",     () => setStatus("processing"));
    const u3 = listen("command-mode-started",   () => { setTranscribedText(""); setIsError(false); setStatus("command"); });
    const u4 = listen<{raw?:string;cleaned?:string;error?:string}>("processing-done", (ev) => {
      const p = ev.payload;
      if (p.error) { setTranscribedText(p.error==="Cancelled"?"Cancelled":`Error: ${p.error}`); setIsError(p.error!=="Cancelled"); }
      else if (p.cleaned) { setTranscribedText(p.cleaned); setIsError(false); }
      else { setTranscribedText(""); setIsError(false); }
      setStatus("done");
    });

    return () => {
      if (ampRef.current) clearInterval(ampRef.current);
      u1.then(f=>f()); u2.then(f=>f()); u3.then(f=>f()); u4.then(f=>f());
    };
  }, []);

  /* ── click handler ───────────────────────────────────────────── */
  const handleClick = async () => {
    if (status === "idle")                                   await invoke("start_recording_cmd").catch(console.error);
    else if (status === "recording" || status === "command") await invoke("stop_and_transcribe_cmd").catch(console.error);
  };

  /* ── computed ─────────────────────────────────────────────────── */
  const mm = Math.floor(elapsed/60).toString().padStart(2,"0");
  const ss = (elapsed%60).toString().padStart(2,"0");

  const isActive = status !== "idle";

  const borderColor =
    status === "command" ? "rgba(167,139,250,0.5)"
    : status === "done" && isError ? "rgba(239,68,68,0.45)"
    : status === "done" ? "rgba(34,197,94,0.45)"
    : status === "recording" ? "rgba(124,58,237,0.4)"
    : "rgba(255,255,255,0.14)";

  const glowColor =
    status === "command" ? "0 0 18px rgba(167,139,250,0.3)"
    : status === "done" && isError ? "0 0 16px rgba(239,68,68,0.25)"
    : status === "done" ? "0 0 16px rgba(34,197,94,0.25)"
    : status === "recording" ? "0 0 18px rgba(124,58,237,0.25)"
    : "0 0 12px rgba(255,255,255,0.06)";

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div
      onClick={handleClick}
      style={{
        /* fill the native window exactly */
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        /* pill shape */
        borderRadius: "999px",
        background: "rgba(18,18,18,0.52)",
        border: `1px solid ${borderColor}`,
        boxShadow: `inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -1px 2px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.55), ${glowColor}`,
        backdropFilter: "blur(32px) saturate(200%)",
        WebkitBackdropFilter: "blur(32px) saturate(200%)",

        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        fontFamily: "'Inter', sans-serif",
        transition: "border-color 0.4s, box-shadow 0.4s",
      }}
    >
      {/* glare highlight */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "50%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 100%)",
        pointerEvents: "none", borderRadius: "999px 999px 0 0",
      }} />

      {/* ─── IDLE ──────────────────────────────────────────── */}
      {!isActive && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"100%", height:"100%", position:"relative", zIndex:2 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
            <line x1="12" x2="12" y1="19" y2="22"/>
          </svg>
        </div>
      )}

      {/* ─── RECORDING / COMMAND ───────────────────────────── */}
      {(status === "recording" || status === "command") && (
        <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"0 16px", width:"100%", position:"relative", zIndex:2 }}>
          {/* dot */}
          <div style={{
            width:"7px", height:"7px", borderRadius:"50%", flexShrink:0,
            backgroundColor: status==="command"?"#a78bfa":"#ef4444",
            boxShadow: status==="command"?"0 0 8px rgba(167,139,250,0.8)":"0 0 8px rgba(239,68,68,0.8)",
            animation: "pulse 1.2s ease-in-out infinite",
          }} />

          {/* waveform */}
          <div style={{ display:"flex", alignItems:"center", gap:"2px", height:"22px", flex:1 }}>
            {bars.map((amp, i) => {
              const bias = 1 - Math.abs(i - 3.5)/4;
              const h = Math.max(3, amp * 22 * (0.5 + bias*0.5));
              return <div key={i} style={{
                flex:1, height:`${h}px`, borderRadius:"1.5px",
                background: status==="command"
                  ? "linear-gradient(180deg,#c084fc,#a78bfa)"
                  : "linear-gradient(180deg,#a78bfa,#7c3aed)",
                transition:"height 80ms ease-out",
                opacity: 0.65 + amp*0.35,
              }} />;
            })}
          </div>

          {/* timer */}
          <span style={{
            color:"#fafafa", fontSize:"12px", fontVariantNumeric:"tabular-nums",
            fontWeight:600, letterSpacing:"0.02em", minWidth:"32px", flexShrink:0,
          }}>{mm}:{ss}</span>

          {/* hint */}
          <span style={{ color:"rgba(255,255,255,0.35)", fontSize:"10px", fontWeight:500, whiteSpace:"nowrap", flexShrink:0 }}>
            {status==="command"?"CMD":"tap"}
          </span>
        </div>
      )}

      {/* ─── PROCESSING ────────────────────────────────────── */}
      {status === "processing" && (
        <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"0 16px", width:"100%", position:"relative", zIndex:2 }}>
          <div style={{
            width:"7px", height:"7px", borderRadius:"50%", flexShrink:0,
            backgroundColor:"#f59e0b", boxShadow:"0 0 8px rgba(245,158,11,0.8)",
            animation:"pulse 1.2s ease-in-out infinite",
          }} />
          <span style={{ color:"rgba(255,255,255,0.75)", fontSize:"12px", fontWeight:500, animation:"shimmer 1.5s infinite alternate" }}>
            Transcribing…
          </span>
        </div>
      )}

      {/* ─── DONE ──────────────────────────────────────────── */}
      {status === "done" && (
        <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"0 16px", width:"100%", position:"relative", zIndex:2 }}>
          <div style={{
            width:"7px", height:"7px", borderRadius:"50%", flexShrink:0,
            backgroundColor: isError?"#ef4444":"#22c55e",
            boxShadow: isError?"0 0 8px rgba(239,68,68,0.8)":"0 0 8px rgba(34,197,94,0.8)",
          }} />
          <div style={{
            color: isError?"#fca5a5":"#e4e4e7", fontSize:"12px", fontWeight:500,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1,
          }}>
            {isError ? transcribedText : `"${transcribedText}"`}
          </div>
        </div>
      )}

      {/* keyframes */}
      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:0.45; transform:scale(0.82); }
        }
        @keyframes shimmer {
          0%   { opacity:0.55; }
          100% { opacity:1; }
        }
      `}</style>
    </div>
  );
}
