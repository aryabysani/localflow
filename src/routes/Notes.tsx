import { useState, useEffect, useRef, useCallback } from "react";
import { getNotes, saveNote, deleteNote, Note } from "../lib/ipc";
import { useAppStore } from "../lib/store";
import { Plus, Trash2, FileText, Mic } from "lucide-react";

function generateId() {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isRecording, isProcessing, startRecording, stopRecording, lastTranscript } = useAppStore();

  const activeNote = notes.find((n) => n.id === activeNoteId);

  const load = useCallback(async () => {
    const data = await getNotes();
    setNotes(data);
    if (data.length > 0 && !activeNoteId) {
      setActiveNoteId(data[0].id);
      setContent(data[0].content);
      setTitle(data[0].title);
    }
  }, [activeNoteId]);

  useEffect(() => {
    load();
  }, []);

  // Append last transcript to active note
  useEffect(() => {
    if (lastTranscript && activeNoteId) {
      const append = " " + lastTranscript.cleaned;
      setContent((prev) => prev + append);
    }
  }, [lastTranscript]);

  // Auto-save
  useEffect(() => {
    if (!activeNoteId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await saveNote(activeNoteId, title || "Untitled", content, "default");
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [content, title, activeNoteId]);

  const createNote = async () => {
    const id = generateId();
    await saveNote(id, "Untitled Note", "", "default");
    const newNote: Note = {
      id,
      title: "Untitled Note",
      content: "",
      folder: "default",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(id);
    setContent("");
    setTitle("Untitled Note");
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
    setNotes((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      if (activeNoteId === id) {
        if (remaining.length > 0) {
          setActiveNoteId(remaining[0].id);
          setContent(remaining[0].content);
          setTitle(remaining[0].title);
        } else {
          setActiveNoteId(null);
          setContent("");
          setTitle("");
        }
      }
      return remaining;
    });
  };

  const selectNote = (note: Note) => {
    // Save current before switching
    if (activeNoteId && content !== undefined) {
      saveNote(activeNoteId, title || "Untitled", content, "default").catch(console.error);
    }
    setActiveNoteId(note.id);
    setContent(note.content);
    setTitle(note.title);
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Note list sidebar */}
      <div
        style={{
          width: "220px",
          borderRight: "1px solid #1a1a1a",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#a1a1aa" }}>Notes</span>
          <button
            onClick={createNote}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#7c3aed",
              padding: "4px",
              borderRadius: "4px",
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {notes.length === 0 && (
            <p style={{ fontSize: "12px", color: "#52525b", padding: "8px", textAlign: "center" }}>
              No notes yet
            </p>
          )}
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => selectNote(note)}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                background: activeNoteId === note.id ? "#1a1a2e" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "2px",
              }}
              onMouseEnter={(e) => {
                if (activeNoteId !== note.id)
                  (e.currentTarget as HTMLDivElement).style.background = "#141414";
              }}
              onMouseLeave={(e) => {
                if (activeNoteId !== note.id)
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
              }}
            >
              <FileText size={14} style={{ color: "#52525b", flexShrink: 0 }} />
              <span
                style={{
                  fontSize: "13px",
                  color: activeNoteId === note.id ? "#fafafa" : "#a1a1aa",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {note.title || "Untitled"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNote(note.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#3f3f46",
                  padding: "2px",
                  flexShrink: 0,
                  opacity: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
                  (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#3f3f46";
                  (e.currentTarget as HTMLButtonElement).style.opacity = "0";
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {activeNote || activeNoteId ? (
          <>
            {/* Toolbar */}
            <div
              style={{
                padding: "12px 24px",
                borderBottom: "1px solid #1a1a1a",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title…"
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#fafafa",
                  outline: "none",
                }}
              />
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: isRecording ? "#1a0a0a" : "#7c3aed20",
                  border: `1px solid ${isRecording ? "#ef4444" : "#7c3aed50"}`,
                  borderRadius: "7px",
                  padding: "7px 14px",
                  fontSize: "13px",
                  color: isRecording ? "#ef4444" : "#a78bfa",
                  cursor: "pointer",
                }}
              >
                <Mic size={14} />
                {isProcessing ? "Processing…" : isRecording ? "Stop" : "Dictate"}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(content);
                }}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "7px",
                  padding: "7px 14px",
                  fontSize: "13px",
                  color: "#a1a1aa",
                  cursor: "pointer",
                }}
              >
                Copy
              </button>
              <span style={{ fontSize: "11px", color: "#3f3f46" }}>Auto-saving…</span>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start typing or dictate with the mic button above (or Ctrl+Shift+Space)…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                padding: "24px",
                fontSize: "15px",
                lineHeight: "1.8",
                color: "#e4e4e7",
                fontFamily: "Inter, sans-serif",
              }}
            />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              color: "#52525b",
            }}
          >
            <FileText size={48} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: "14px", margin: 0 }}>Select a note or create a new one</p>
            <button
              onClick={createNote}
              style={{
                background: "#7c3aed",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "14px",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              New Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
