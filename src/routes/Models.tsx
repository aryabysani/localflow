import { useEffect, useState } from "react";
import { CheckCircle, Cpu, Download, HardDrive, Gauge, Zap } from "lucide-react";
import { downloadModel, listModels, ModelInfo, setActiveModel } from "../lib/ipc";

const MODEL_COMPARISONS: Record<string, {
  speed: string;
  cpu: string;
  ramDiff: string;
}> = {
  "tiny.en": {
    speed: "Fastest (Baseline: ~0.15s)",
    cpu: "Ultra-light (1-2 threads)",
    ramDiff: "Baseline (~128MB)"
  },
  "base.en": {
    speed: "1.5x slower than Tiny (~0.25s)",
    cpu: "Light (2 threads)",
    ramDiff: "+72MB RAM from Tiny"
  },
  "small.en": {
    speed: "3x slower than Base (~0.8s)",
    cpu: "Moderate (4 threads)",
    ramDiff: "+300MB RAM from Base"
  },
  "medium.en": {
    speed: "4x slower than Small (~3.2s)",
    cpu: "Heavy spikes (uses all threads)",
    ramDiff: "+700MB RAM from Small"
  },
  "large-v3-turbo": {
    speed: "1.5x slower than Medium (~4.8s)",
    cpu: "Full CPU load (max threads)",
    ramDiff: "+600MB RAM from Medium"
  },
  "distil-large-v3": {
    speed: "2.5x faster than Large Turbo (~1.8s)",
    cpu: "High spikes, short burst",
    ramDiff: "-800MB RAM from Large Turbo"
  }
};

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeModel, setActiveModelState] = useState("ggml-small.en-q5_1.bin");
  const [downloadStatus, setDownloadStatus] = useState<Record<string, string>>({});

  const load = async () => setModels(await listModels());

  useEffect(() => {
    load().catch(console.error);
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

  const formatSize = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Whisper models</p>
          <h2 className="page-title">Models</h2>
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
          const status = downloadStatus[model.id];

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
                <div className="model-meta">
                  <span className="row-desc">
                    <HardDrive size={13} />
                    {formatSize(model.size_mb)}
                  </span>
                  <span className="row-desc">
                    <Cpu size={13} />
                    ~{formatSize(model.ram_mb)} RAM
                  </span>
                  {MODEL_COMPARISONS[model.id] && (
                    <>
                      <span className="row-desc" title="Relative speed comparison" style={{ color: "var(--accent)" }}>
                        <Gauge size={13} />
                        {MODEL_COMPARISONS[model.id].speed}
                      </span>
                      <span className="row-desc" title="RAM differential compared to previous model" style={{ color: "var(--warning)" }}>
                        <Zap size={13} />
                        {MODEL_COMPARISONS[model.id].ramDiff}
                      </span>
                    </>
                  )}
                  {status && <span className="row-desc">{status}</span>}
                </div>
              </div>

              <div>
                {model.downloaded ? (
                  !isActive && (
                    <button className="button" onClick={() => handleSetActive(model.filename)}>
                      Set active
                    </button>
                  )
                ) : (
                  <button className="button primary" disabled={isDownloading || !!downloading} onClick={() => handleDownload(model)}>
                    <Download size={14} />
                    {isDownloading ? "Downloading" : `Download ${formatSize(model.size_mb)}`}
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
