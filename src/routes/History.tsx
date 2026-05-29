import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clipboard, Search, Trash2 } from "lucide-react";
import { clearHistory, deleteHistoryEntry, DictationEntry, getHistory, getSetting, setSetting } from "../lib/ipc";
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
        <span className="truncate" style={{ fontSize: 13, color: entry.cleaned_text ? "var(--label)" : "var(--tertiary)", fontStyle: entry.cleaned_text ? "normal" : "italic" }}>
          {entry.cleaned_text || "(Transcript omitted - history disabled)"}
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
            <p style={{ margin: 0, color: entry.cleaned_text ? "var(--label)" : "var(--tertiary)", fontSize: 14, lineHeight: "22px", fontStyle: entry.cleaned_text ? "normal" : "italic" }}>
              {entry.cleaned_text || "(Text content was not saved because history saving was disabled for this session. Only word count and duration statistics were recorded.)"}
            </p>
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
            <button className="button" disabled={!entry.cleaned_text} onClick={() => entry.cleaned_text && navigator.clipboard.writeText(entry.cleaned_text)}>
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
  const [saveHistoryEnabled, setSaveHistoryEnabled] = useState(true);
  const { lastTranscript } = useAppStore();

  const loadSetting = useCallback(async () => {
    try {
      const val = await getSetting("save_history");
      setSaveHistoryEnabled(val !== "false");
    } catch (e) {
      console.error("Failed to load save_history setting:", e);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await getHistory(search || undefined, 100));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadSetting().catch(console.error);
    load().catch(console.error);
  }, [load, loadSetting, lastTranscript]);

  const handleToggleSaveHistory = async () => {
    const nextVal = !saveHistoryEnabled;
    setSaveHistoryEnabled(nextVal);
    await setSetting("save_history", nextVal ? "true" : "false");
  };

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

      <section className="glass-panel" style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Save Transcripts in History</h3>
          <p className="row-desc" style={{ margin: "2px 0 0 0", fontSize: 11.5 }}>
            When disabled, only speech word counts and durations (stats) are recorded. Transcripts are discarded immediately.
          </p>
        </div>
        <button
          className={`switch ${saveHistoryEnabled ? "on" : ""}`}
          onClick={handleToggleSaveHistory}
          aria-pressed={saveHistoryEnabled}
        >
          <span />
        </button>
      </section>

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
