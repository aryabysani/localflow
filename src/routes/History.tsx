import { useEffect, useState, useCallback } from "react";
import { getHistory, deleteHistoryEntry, clearHistory, DictationEntry } from "../lib/ipc";
import { Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "../lib/store";

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function HistoryRow({
  entry,
  onDelete,
}: {
  entry: DictationEntry;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "#0d0d0d",
        border: "1px solid #1a1a1a",
        borderRadius: "10px",
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#2a2a2a")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a")}
    >
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* App badge */}
        <div
          style={{
            background: "#1a1a2e",
            border: "1px solid #2a2a4a",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "11px",
            color: "#a78bfa",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {entry.app_name || "Unknown"}
        </div>

        {/* Text preview */}
        <span
          style={{
            flex: 1,
            fontSize: "14px",
            color: "#e4e4e7",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.cleaned_text}
        </span>

        {/* Meta */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
          <span style={{ fontSize: "11px", color: "#52525b" }}>
            {entry.word_count}w · {Math.round(entry.duration_secs)}s
          </span>
          <span style={{ fontSize: "11px", color: "#52525b" }}>{formatDate(entry.timestamp)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(entry.id);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#3f3f46",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#3f3f46")}
          >
            <Trash2 size={14} />
          </button>
          {expanded ? (
            <ChevronUp size={14} style={{ color: "#52525b" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "#52525b" }} />
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ height: "1px", background: "#1a1a1a" }} />
          <div>
            <div style={{ fontSize: "11px", color: "#52525b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Cleaned
            </div>
            <p style={{ fontSize: "14px", color: "#d4d4d8", margin: 0, lineHeight: 1.6 }}>
              {entry.cleaned_text}
            </p>
          </div>
          {entry.raw_text && entry.raw_text !== entry.cleaned_text && (
            <div>
              <div style={{ fontSize: "11px", color: "#52525b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Raw Transcript
              </div>
              <p style={{ fontSize: "13px", color: "#71717a", margin: 0, lineHeight: 1.6, fontFamily: "monospace" }}>
                {entry.raw_text}
              </p>
            </div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => navigator.clipboard.writeText(entry.cleaned_text)}
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                color: "#a1a1aa",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
            <span style={{ fontSize: "12px", color: "#3f3f46", alignSelf: "center" }}>
              Language: {entry.language} · {formatDate(entry.timestamp)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<DictationEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { lastTranscript } = useAppStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHistory(search || undefined, 100);
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load, lastTranscript]);

  const handleDelete = async (id: number) => {
    await deleteHistoryEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClearAll = async () => {
    if (!confirm("Delete all dictation history? This cannot be undone.")) return;
    await clearHistory();
    setEntries([]);
  };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fafafa", margin: 0 }}>History</h1>
          <p style={{ fontSize: "13px", color: "#71717a", margin: "4px 0 0" }}>
            {entries.length} dictation{entries.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={handleClearAll}
            style={{
              background: "#1a0a0a",
              border: "1px solid #3f1a1a",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              color: "#f87171",
              cursor: "pointer",
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search
          size={16}
          style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#52525b" }}
        />
        <input
          type="text"
          placeholder="Search transcripts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            background: "#111",
            border: "1px solid #1f1f1f",
            borderRadius: "8px",
            padding: "10px 14px 10px 40px",
            fontSize: "14px",
            color: "#fafafa",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: "#52525b", fontSize: "14px" }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div
          style={{
            background: "#0a0a0a",
            border: "1px dashed #2a2a2a",
            borderRadius: "12px",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fafafa", margin: "0 0 8px" }}>
            {search ? "No results found" : "No dictations yet"}
          </h3>
          <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>
            {search
              ? "Try a different search term"
              : "Your dictation history will appear here after your first recording."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {entries.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
