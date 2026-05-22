import { useEffect, useState } from "react";
import { getDictionary, addDictionaryEntry, deleteDictionaryEntry, DictionaryEntry } from "../lib/ipc";
import { Plus, Trash2, BookOpen } from "lucide-react";

export default function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [term, setTerm] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [replacement, setReplacement] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const data = await getDictionary();
    setEntries(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!term.trim()) return;
    setAdding(true);
    try {
      await addDictionaryEntry(term.trim(), pronunciation.trim(), replacement.trim());
      setTerm("");
      setPronunciation("");
      setReplacement("");
      setShowForm(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteDictionaryEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const inputStyle = {
    background: "#111",
    border: "1px solid #1f1f1f",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    color: "#fafafa",
    outline: "none",
    flex: 1,
  };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fafafa", margin: 0 }}>Dictionary</h1>
          <p style={{ fontSize: "13px", color: "#71717a", margin: "4px 0 0" }}>
            Add proper nouns, brand names, and acronyms to improve transcription accuracy.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#7c3aed",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            fontSize: "13px",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <Plus size={16} />
          Add Term
        </button>
      </div>

      {/* Info card */}
      <div
        style={{
          background: "#0f0f1a",
          border: "1px solid #2a2a4a",
          borderRadius: "10px",
          padding: "16px 20px",
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <BookOpen size={16} style={{ color: "#7c3aed", flexShrink: 0, marginTop: "2px" }} />
        <div style={{ fontSize: "13px", color: "#a1a1aa", lineHeight: 1.6 }}>
          Terms in your dictionary are injected into Whisper as vocabulary hints. This helps with
          names like <strong style={{ color: "#e4e4e7" }}>TAPMI</strong>,{" "}
          <strong style={{ color: "#e4e4e7" }}>Zepto</strong>, or{" "}
          <strong style={{ color: "#e4e4e7" }}>Hinglish</strong> terms that standard models might mishear.
          If you also set a <em>replacement</em>, that text is swapped in after transcription.
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div
          style={{
            background: "#111",
            border: "1px solid #2a2a2a",
            borderRadius: "12px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#a1a1aa" }}>New Dictionary Entry</div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input
              placeholder="Term (e.g. TAPMI)"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <input
              placeholder="Pronunciation hint (optional)"
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Replacement text (optional)"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleAdd}
              disabled={!term.trim() || adding}
              style={{
                background: "#7c3aed",
                border: "none",
                borderRadius: "7px",
                padding: "9px 18px",
                fontSize: "13px",
                color: "#fff",
                cursor: "pointer",
                opacity: (!term.trim() || adding) ? 0.5 : 1,
              }}
            >
              {adding ? "Adding…" : "Add Entry"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "7px",
                padding: "9px 18px",
                fontSize: "13px",
                color: "#a1a1aa",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {entries.length === 0 ? (
        <div
          style={{
            background: "#0a0a0a",
            border: "1px dashed #2a2a2a",
            borderRadius: "12px",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📖</div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fafafa", margin: "0 0 8px" }}>
            Dictionary is empty
          </h3>
          <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>
            Add terms like your name, company, product names, or technical acronyms.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "#111",
            border: "1px solid #1f1f1f",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr auto",
              padding: "12px 16px",
              background: "#0a0a0a",
              borderBottom: "1px solid #1f1f1f",
              fontSize: "11px",
              color: "#52525b",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              gap: "16px",
            }}
          >
            <span>Term</span>
            <span>Pronunciation</span>
            <span>Replacement</span>
            <span></span>
          </div>
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto",
                padding: "12px 16px",
                borderBottom: i < entries.length - 1 ? "1px solid #1a1a1a" : "none",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "14px", color: "#e4e4e7", fontWeight: 500 }}>{entry.term}</span>
              <span style={{ fontSize: "13px", color: "#71717a", fontStyle: entry.pronunciation ? "normal" : "italic" }}>
                {entry.pronunciation || "—"}
              </span>
              <span style={{ fontSize: "13px", color: "#71717a", fontStyle: entry.replacement ? "normal" : "italic" }}>
                {entry.replacement || "—"}
              </span>
              <button
                onClick={() => handleDelete(entry.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#3f3f46",
                  padding: "4px",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#3f3f46")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
