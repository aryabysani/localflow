import { useEffect, useState } from "react";
import { Info, Keyboard, MousePointerClick } from "lucide-react";
import { getSetting, setSetting, reloadGlobalShortcut } from "../lib/ipc";

function getWindowsVkCode(code: string, keyCode: number): number {
  switch (code) {
    case "ShiftLeft": return 0xA0; // VK_LSHIFT
    case "ShiftRight": return 0xA1; // VK_RSHIFT
    case "ControlLeft": return 0xA2; // VK_LCONTROL
    case "ControlRight": return 0xA3; // VK_RCONTROL
    case "AltLeft": return 0xA4; // VK_LMENU
    case "AltRight": return 0xA5; // VK_RMENU
    case "CapsLock": return 0x14; // VK_CAPITAL
    case "Escape": return 0x1B; // VK_ESCAPE
    case "Space": return 0x20; // VK_SPACE
    case "Backquote": return 0xC0; // VK_OEM_3 (tilde)
    default: return keyCode;
  }
}

function Keycaps({ keys }: { keys: string[] }) {
  return (
    <span className="keycap-row">
      {keys.map((key, idx) =>
        key === "+" ? (
          <span key={idx} className="keycap-plus">
            +
          </span>
        ) : (
          <span key={idx} className="keycap">
            {key}
          </span>
        ),
      )}
    </span>
  );
}

export default function ShortcutsPage() {
  const [shortcutToggle, setShortcutToggle] = useState("Ctrl+Alt");
  const [keybindKeyboardName, setKeybindKeyboardName] = useState("Ctrl+Q");
  const [keybindKeyboardMode, setKeybindKeyboardMode] = useState("hold");
  const [showBanner, setShowBanner] = useState(() => {
    return localStorage.getItem("localflow_shortcuts_banner_closed") !== "true";
  });

  const handleCloseBanner = () => {
    setShowBanner(false);
    localStorage.setItem("localflow_shortcuts_banner_closed", "true");
  };
  
  const [keybindMouse, setKeybindMouse] = useState("middle");
  const [keybindMouseName, setKeybindMouseName] = useState("Middle Click");
  const [keybindMouseMode, setKeybindMouseMode] = useState("hold");

  // Re-binding active listener states
  const [isBinding, setIsBinding] = useState<"toggle" | "keyboard" | "mouse" | null>(null);
  const [bindResult, setBindResult] = useState<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const toggle = await getSetting("shortcut_toggle");
      if (toggle) setShortcutToggle(toggle);

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
        setKeybindKeyboardName("Ctrl+Q"); // default fallback
      }

      if (kbMode) {
        setKeybindKeyboardMode(kbMode);
      } else if (kbOld) {
        setKeybindKeyboardMode(kbOld.includes("double") || kbOld === "rshift_ralt" ? "double_tap" : "hold");
      }

      const mouse = await getSetting("keybind_mouse");
      const mouseName = await getSetting("keybind_mouse_name");
      const mouseMode = await getSetting("keybind_mouse_mode");
      
      if (mouse) {
        setKeybindMouse(mouse);
      } else {
        setKeybindMouse("middle"); // default
      }
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
      } else {
        setKeybindMouseName("Middle Click");
      }
      if (mouseMode) setKeybindMouseMode(mouseMode);
    };
    loadSettings().catch(console.error);
  }, []);

  // Window Event Listeners for Keybinding Capture
  useEffect(() => {
    if (!isBinding) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape" && !bindResult) {
        setIsBinding(null);
        return;
      }

      if (isBinding === "toggle") {
        if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
          return;
        }

        const parts: string[] = [];
        if (e.ctrlKey) parts.push("Ctrl");
        if (e.shiftKey) parts.push("Shift");
        if (e.altKey) parts.push("Alt");
        
        let keyName = e.key;
        if (e.code === "Space") keyName = "Space";
        keyName = keyName.charAt(0).toUpperCase() + keyName.slice(1);
        parts.push(keyName);

        const shortcutStr = parts.join("+");
        setSetting("shortcut_toggle", shortcutStr).then(async () => {
          try {
            await reloadGlobalShortcut();
          } catch (err) {
            console.error("Failed to reload global shortcut:", err);
          }
          setShortcutToggle(shortcutStr);
          setIsBinding(null);
        });
        return;
      }

      // Keyboard Trigger
      let name = "";
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");

      // Main key name mapping
      let mainKeyName = e.key;
      if (e.code === "Space") mainKeyName = "Space";
      else if (e.code === "AltRight") mainKeyName = "Right Alt";
      else if (e.code === "AltLeft") mainKeyName = "Left Alt";
      else if (e.code === "ControlRight") mainKeyName = "Right Ctrl";
      else if (e.code === "ControlLeft") mainKeyName = "Left Ctrl";
      else if (e.code === "ShiftRight") mainKeyName = "Right Shift";
      else if (e.code === "ShiftLeft") mainKeyName = "Left Shift";

      mainKeyName = mainKeyName.charAt(0).toUpperCase() + mainKeyName.slice(1);

      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        // If they only hold a modifier, display it
        name = mainKeyName;
      } else {
        parts.push(mainKeyName);
        name = parts.join("+");
      }

      const vk = getWindowsVkCode(e.code, e.keyCode);
      setBindResult({ type: "keyboard", name, vk });
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isBinding === "toggle") return;

      let name = "";
      let buttonType = "";

      if (e.button === 1) {
        name = "Middle Click";
        buttonType = "middle";
      } else if (e.button === 3) {
        name = "Mouse Button 4";
        buttonType = "back";
      } else if (e.button === 4) {
        name = "Mouse Button 5";
        buttonType = "forward";
      } else if (e.button === 2) {
        name = "Right Click";
        buttonType = "right";
      } else {
        return; // Ignore left clicks
      }

      e.preventDefault();
      e.stopPropagation();

      setBindResult({ type: "mouse", name, button: buttonType });
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [isBinding, bindResult]);

  const handleSaveBind = async (mode: string) => {
    if (!bindResult) return;

    if (isBinding === "keyboard") {
      await setSetting("keybind_keyboard_vk", String(bindResult.vk));
      await setSetting("keybind_keyboard_name", bindResult.name);
      await setSetting("keybind_keyboard_mode", mode);
      await setSetting("keybind_keyboard", ""); // Clear legacy

      setKeybindKeyboardName(bindResult.name);
      setKeybindKeyboardMode(mode);
    } else if (isBinding === "mouse") {
      await setSetting("keybind_mouse", bindResult.button);
      await setSetting("keybind_mouse_name", bindResult.name);
      await setSetting("keybind_mouse_mode", mode);

      setKeybindMouse(bindResult.button);
      setKeybindMouseName(bindResult.name);
      setKeybindMouseMode(mode);
    }

    setIsBinding(null);
    setBindResult(null);
  };

  const handleClearMouseBind = async () => {
    await setSetting("keybind_mouse", "none");
    await setSetting("keybind_mouse_name", "None");
    setKeybindMouse("none");
    setKeybindMouseName("None");
  };

  // Build shortcut list for display
  const toggleKeys = shortcutToggle.split("+");

  const shortcuts = [
    ["Toggle dictation", toggleKeys, "Press once to start, and once you're done talking, press those keys again.", Keyboard],
    ["Instant dictation", [keybindKeyboardName], "Keep holding the key to record. If you release it, recording stops and starts translating.", Keyboard],
    ...(keybindMouse !== "none" ? [
      ["Mouse dictation", [keybindMouseName], `Hold mouse button to record (Release to transcribe).`, MousePointerClick]
    ] as const : []),
    ["Cancel recording", ["Esc"], "Cancel without transcribing or pasting.", Keyboard],
  ] as const;

  return (
    <div className="page narrow" style={{ position: "relative" }}>
      {/* Keybinding Modal Overlay */}
      {isBinding && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
          display: "grid",
          placeItems: "center",
          zIndex: 9999,
        }}>
          <div className="glass-panel" style={{ width: 340, padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              {isBinding === "toggle" ? "Record Global Toggle" :
               isBinding === "keyboard" ? "Record Keyboard Trigger" :
               "Record Mouse Trigger"}
            </h3>
            
            {!bindResult ? (
              <>
                <p style={{ margin: 0, fontSize: 13, color: "var(--secondary)", lineHeight: "18px" }}>
                  Press the key or mouse button combination you want to bind.
                </p>
                <div style={{ fontSize: 20, fontWeight: 700, padding: "15px 0", color: "var(--accent)" }}>
                  Listening...
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "var(--tertiary)" }}>
                  Press <kbd style={{ padding: "2px 4px", background: "var(--quaternary)", borderRadius: 3 }}>Esc</kbd> to cancel.
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 13, color: "var(--secondary)" }}>
                  Detected button: <strong style={{ color: "var(--accent)" }}>{bindResult.name}</strong>
                </p>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Choose trigger type</span>
                  <button className="button primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => handleSaveBind("hold")}>Hold to talk (Release to stop)</button>
                  <button className="button" style={{ width: "100%", justifyContent: "center" }} onClick={() => handleSaveBind("toggle")}>Tap to toggle (Start / Stop)</button>
                  {isBinding === "keyboard" && (
                    <button className="button" style={{ width: "100%", justifyContent: "center" }} onClick={() => handleSaveBind("double_tap")}>Double-tap to toggle</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showBanner && (
        <div className="banner-card" style={{ backgroundImage: "url('/Shortcuts Background.png')" }}>
          <button className="banner-close" onClick={handleCloseBanner} aria-label="Close banner">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
          </button>
          <div className="banner-content">
            <h2 className="banner-title">The keys <em>you</em> shouldn't have to re-type.</h2>
            <p className="banner-desc">
              Configure instant global shortcuts and mouse triggers to instantly control voice recording across any active application.
            </p>
            <div className="banner-actions">
              <span className="banner-tag">Ctrl+Alt Toggle</span>
              <span className="banner-tag">Custom Keyboard Hold</span>
              <span className="banner-tag">Mouse Button Triggers</span>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <p className="page-kicker">Global triggers</p>
          <h2 className="page-title">Shortcuts</h2>
        </div>
      </div>

      <section className="table-panel" style={{ marginBottom: 16 }}>
        {shortcuts.map(([action, keys, description, Icon]) => (
          <div key={action} className="setting-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon size={16} color="var(--secondary)" />
              <div>
                <div className="setting-title">{action}</div>
                <div className="setting-desc">{description}</div>
              </div>
            </div>
            <Keycaps keys={[...keys]} />
          </div>
        ))}
      </section>

      <section className="glass-panel">
        <div className="section-label">Configure triggers</div>
        <div className="setting-list" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Global Toggle Re-binder */}
          <div className="setting-row">
            <div>
              <div className="setting-title">Toggle dictation</div>
              <div className="setting-desc">Double-tap or combination to trigger anywhere.</div>
            </div>
            <button className="button" onClick={() => setIsBinding("toggle")}>
              Rebind Toggle ({shortcutToggle})
            </button>
          </div>

          {/* Keyboard Trigger Re-binder */}
          <div className="setting-row" style={{ borderTop: "1px solid var(--separator-soft)", paddingTop: 12 }}>
            <div>
              <div className="setting-title">Instant dictation key</div>
              <div className="setting-desc">Press button to bind any custom key.</div>
            </div>
            <button className="button" onClick={() => setIsBinding("keyboard")}>
              Rebind Keyboard ({keybindKeyboardName} - {keybindKeyboardMode})
            </button>
          </div>

          {/* Mouse Trigger Re-binder */}
          <div className="setting-row" style={{ borderTop: "1px solid var(--separator-soft)", paddingTop: 12 }}>
            <div>
              <div className="setting-title">Mouse trigger button</div>
              <div className="setting-desc">Bind middle-click or mouse side buttons.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {keybindMouse !== "none" && (
                <button className="button danger" onClick={handleClearMouseBind}>
                  Disable
                </button>
              )}
              <button className="button" onClick={() => setIsBinding("mouse")}>
                Rebind Mouse ({keybindMouseName} - {keybindMouseMode})
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel mac-callout" style={{ marginTop: 16 }}>
        <Info size={16} color="var(--accent)" />
        <p className="row-desc" style={{ margin: 0 }}>
          Click "Rebind" buttons and press any key/mouse combination to save immediately.
        </p>
      </section>
    </div>
  );
}
