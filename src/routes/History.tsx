import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clipboard, Search, Trash2 } from "lucide-react";
import { clearHistory, deleteHistoryEntry, DictationEntry, getHistory } from "../lib/ipc";
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

function HistoryRow({ entry, onDelete }: { entry: DictationEntry; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="history-card">
      <button className="history-summary" onClick={() => setExpanded((v) => !v)}>
        <span className="badge">{entry.app_name || "Unknown"}</span>
        <span className="truncate" style={{ fontSize: 13, color: "var(--label)" }}>
          {entry.cleaned_text}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="subtle" style={{ fontSize: 12 }}>
            {entry.word_count}w · {Math.round(entry.duration_secs)}s
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ borderTop: "1px solid var(--separator-soft)", paddingTop: 12 }}>
            <div className="section-label">Cleaned transcript</div>
            <p style={{ margin: 0, color: "var(--label)", fontSize: 14, lineHeight: "22px" }}>{entry.cleaned_text}</p>
          </div>

          {entry.raw_text && entry.raw_text !== entry.cleaned_text && (
            <div style={{ marginTop: 12 }}>
              <div className="section-label">Raw transcript</div>
              <p
                style={{
                  margin: 0,
                  color: "var(--secondary)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: 12,
                  lineHeight: "18px",
                }}
              >
                {entry.raw_text}
              </p>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <button className="button" onClick={() => navigator.clipboard.writeText(entry.cleaned_text)}>
              <Clipboard size={14} />
              Copy
            </button>
            <button className="button danger" onClick={() => onDelete(entry.id)}>
              <Trash2 size={14} />
              Delete
            </button>
            <span className="subtle" style={{ marginLeft: "auto", fontSize: 12 }}>
              {entry.language} · {formatDate(entry.timestamp)}
            </span>
          </div>
        </div>
      )}
    </article>
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
      setEntries(await getHistory(search || undefined, 100));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load().catch(console.error);
  }, [load, lastTranscript]);

  const handleDelete = async (id: number) => {
    await deleteHistoryEntry(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleClearAll = async () => {
    if (!confirm("Delete all dictation history? This cannot be undone.")) return;
    await clearHistory();
    setEntries([]);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-kicker">{entries.length} saved dictations</p>
          <h2 className="page-title">History</h2>
        </div>
        {entries.length > 0 && (
          <button className="button danger" onClick={handleClearAll}>
            <Trash2 size={14} />
            Clear all
          </button>
        )}
      </div>

      <div className="search-field" style={{ marginBottom: 14 }}>
        <Search />
        <input className="field" placeholder="Search transcripts" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="glass-panel subtle">Loading history...</div>
      ) : entries.length === 0 ? (
        <section className="empty-state">
          <Search size={38} />
          <h3>{search ? "No matching dictations" : "No dictations yet"}</h3>
          <p>{search ? "Try a different term." : "Recorded dictations will appear here after your first session."}</p>
        </section>
      ) : (
        <section>
          {entries.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </section>
      )}
    </div>
  );
}
