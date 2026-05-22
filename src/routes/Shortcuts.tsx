import { Keyboard } from "lucide-react";

const shortcuts = [
  {
    action: "Toggle Dictation",
    keys: ["Ctrl", "Shift", "Space"],
    description: "Start/stop dictation (toggle mode). Works globally.",
  },
  {
    action: "Push-to-Talk",
    keys: ["Right Alt"],
    description: "Hold to record, release to transcribe. (Right Alt based PTT — configure via rdev in future build)",
  },
  {
    action: "Cancel Dictation",
    keys: ["Esc"],
    description: "Cancel active recording without injecting text. (Coming in next build)",
  },
  {
    action: "Command Mode",
    keys: ["Right Ctrl", "+", "Right Alt"],
    description: "Select text first, then speak a transformation command. (Coming in next build)",
  },
];

export default function ShortcutsPage() {
  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "640px" }}>
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fafafa", margin: 0 }}>Shortcuts</h1>
        <p style={{ fontSize: "13px", color: "#71717a", margin: "4px 0 0" }}>
          Global keyboard shortcuts that work in any Windows application.
        </p>
      </div>

      <div
        style={{
          background: "#111",
          border: "1px solid #1f1f1f",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {shortcuts.map((sc, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              padding: "18px 20px",
              borderBottom: i < shortcuts.length - 1 ? "1px solid #1a1a1a" : "none",
            }}
          >
            <Keyboard size={16} style={{ color: "#52525b", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 500, color: "#fafafa", marginBottom: "4px" }}>
                {sc.action}
              </div>
              <div style={{ fontSize: "12px", color: "#71717a" }}>{sc.description}</div>
            </div>
            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
              {sc.keys.map((key, ki) => (
                <span
                  key={ki}
                  style={
                    key === "+"
                      ? { color: "#3f3f46", fontSize: "12px", alignSelf: "center" }
                      : {
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontFamily: "monospace",
                          color: "#a78bfa",
                          whiteSpace: "nowrap",
                        }
                  }
                >
                  {key}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#0f0f0f",
          border: "1px solid #2a2a2a",
          borderRadius: "10px",
          padding: "14px 18px",
          fontSize: "13px",
          color: "#71717a",
          lineHeight: 1.6,
        }}
      >
        💡 Shortcut rebinding UI is planned for a future release. For now, the toggle shortcut is{" "}
        <strong style={{ color: "#a78bfa", fontFamily: "monospace" }}>Ctrl+Shift+Space</strong> and is
        registered globally. Ensure no other app has claimed this combination.
      </div>
    </div>
  );
}
