import { useEffect, useState } from "react";
import { CheckCircle, Download, Trash2 } from "lucide-react";
import { downloadModel, listModels, ModelInfo, setActiveModel, deleteModel } from "../lib/ipc";
import { listen } from "@tauri-apps/api/event";

const MODEL_COMPARISONS: Record<string, {
  accuracy: string;
  speed: string;
  avgRam: string;
}> = {
  "tiny.en": {
    accuracy: "Tier 1 (Lowest)",
    speed: "1x speed (Baseline)",
    avgRam: "~128 MB (Average)"
  },
  "base.en": {
    accuracy: "Tier 2 (Low)",
    speed: "1.7x slower",
    avgRam: "~200 MB (Average)"
  },
  "small.en": {
    accuracy: "Tier 3 (Good)",
    speed: "5x slower",
    avgRam: "~500 MB (Average)"
  },
  "medium.en": {
    accuracy: "Tier 4 (High)",
    speed: "21x slower",
    avgRam: "~1.2 GB (Average)"
  },
  "distil-large-v3": {
    accuracy: "Tier 5 (Very High)",
    speed: "12x slower",
    avgRam: "~1.0 GB (Average)"
  },
  "large-v3-turbo": {
    accuracy: "Tier 6 (Highest)",
    speed: "32x slower",
    avgRam: "~1.8 GB (Average)"
  }
};

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeModel, setActiveModelState] = useState("ggml-small.en-q5_1.bin");
  const [downloadStatus, setDownloadStatus] = useState<Record<string, string>>({});
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  const load = async () => {
    const list = await listModels();
    setModels(list);
    const active = list.find((m) => m.is_active);
    if (active) {
      setActiveModelState(active.filename);
    }
  };

  useEffect(() => {
    load().catch(console.error);

    const unlisten = listen<{ id: string; progress: number }>(
      "download-progress",
      (event) => {
        setDownloadProgress((prev) => ({
          ...prev,
          [event.payload.id]: event.payload.progress,
        }));
      }
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleDownload = async (model: ModelInfo) => {
    setDownloading(model.id);
    setDownloadStatus((prev) => ({ ...prev, [model.id]: "Downloading" }));
    try {
      const msg = await downloadModel(model.id);
      setDownloadStatus((prev) => ({ ...prev, [model.id]: msg }));
      await load();
    } catch (e) {
      setDownloadStatus((prev) => ({ ...prev, [model.id]: `Download failed: ${e}` }));
    } finally {
      setDownloading(null);
    }
  };

  const handleSetActive = async (filename: string) => {
    await setActiveModel(filename);
    setActiveModelState(filename);
  };

  const handleDelete = async (model: ModelInfo) => {
    if (confirm(`Are you sure you want to delete ${model.name}?`)) {
      try {
        await deleteModel(model.id);
        await load();
      } catch (e) {
        alert(`Failed to delete model: ${e}`);
      }
    }
  };

  const formatSize = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Whisper models</p>
          <h2 className="page-title">Local LLM</h2>
        </div>
      </div>

      <section className="glass-panel" style={{ marginBottom: 14 }}>
        <p className="row-desc" style={{ margin: 0 }}>
          Start with Small English for speed. Use Large V3 Turbo for multilingual or Hinglish dictation.
        </p>
      </section>

      <section className="grid">
        {models.map((model) => {
          const isActive = activeModel === model.filename;
          const isDownloading = downloading === model.id;
          const progress = downloadProgress[model.id];
          const status = isDownloading && progress !== undefined
            ? `Downloading... (${progress}%)`
            : downloadStatus[model.id];

          return (
            <article key={model.id} className="glass-panel model-card">
              <div className="brand-icon" style={{ width: 40, height: 40 }}>
                {model.downloaded ? <CheckCircle size={19} color="var(--success)" /> : <Download size={19} />}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span className="row-title">{model.name}</span>
                  {isActive && <span className="badge">Active</span>}
                </div>
                <p className="row-desc" style={{ margin: 0 }}>{model.description}</p>
                
                <div className="model-specs-grid">
                  <div className="spec-item">
                    <span className="spec-label">Accuracy</span>
                    <span className="spec-value">{MODEL_COMPARISONS[model.id]?.accuracy || "N/A"}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">File Size</span>
                    <span className="spec-value">{formatSize(model.size_mb)}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Average RAM</span>
                    <span className="spec-value">{MODEL_COMPARISONS[model.id]?.avgRam || `~${formatSize(model.ram_mb)} (Average)`}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Speed</span>
                    <span className="spec-value highlight">{MODEL_COMPARISONS[model.id]?.speed || "N/A"}</span>
                  </div>
                </div>

                {status && (
                  <div style={{ marginTop: 8 }}>
                    <span className="row-desc" style={{ color: "var(--accent)" }}>{status}</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {model.downloaded ? (
                  <>
                    {!isActive && (
                      <button className="button" onClick={() => handleSetActive(model.filename)}>
                        Set active
                      </button>
                    )}
                    <button
                      className="button danger icon"
                      onClick={() => handleDelete(model)}
                      disabled={isActive}
                      title={isActive ? "Cannot delete the active model" : `Delete ${model.name}`}
                      style={{ border: "1px solid var(--separator-soft)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <button className="button primary" disabled={isDownloading || !!downloading} onClick={() => handleDownload(model)}>
                    <Download size={14} />
                    {isDownloading
                      ? `Downloading ${progress !== undefined ? `(${progress}%)` : ""}`
                      : `Download ${formatSize(model.size_mb)}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
