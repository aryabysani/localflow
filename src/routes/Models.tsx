import { useEffect, useState } from "react";
import { CheckCircle, Cpu, Download, HardDrive } from "lucide-react";
import { downloadModel, listModels, ModelInfo, setActiveModel } from "../lib/ipc";

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
