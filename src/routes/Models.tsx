import { useEffect, useState } from "react";
import { listModels, downloadModel, setActiveModel, ModelInfo } from "../lib/ipc";
import { Download, CheckCircle, Cpu, HardDrive } from "lucide-react";

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeModel, setActiveModelState] = useState<string>("ggml-small.en-q5_1.bin");
  const [downloadStatus, setDownloadStatus] = useState<Record<string, string>>({});

  const load = async () => {
    const data = await listModels();
    setModels(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDownload = async (model: ModelInfo) => {
    setDownloading(model.id);
    setDownloadStatus((prev) => ({ ...prev, [model.id]: "Downloading… (this may take a few minutes)" }));
    try {
      const msg = await downloadModel(model.id);
      setDownloadStatus((prev) => ({ ...prev, [model.id]: msg }));
      await load();
    } catch (e) {
      setDownloadStatus((prev) => ({ ...prev, [model.id]: `Error: ${e}` }));
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
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fafafa", margin: 0 }}>Models</h1>
        <p style={{ fontSize: "13px", color: "#71717a", margin: "4px 0 0" }}>
          Download and manage Whisper speech-to-text models. All models run 100% locally.
        </p>
      </div>

      {/* Info */}
      <div
        style={{
          background: "#0f0f1a",
          border: "1px solid #2a2a4a",
          borderRadius: "10px",
          padding: "14px 18px",
          fontSize: "13px",
          color: "#a1a1aa",
          lineHeight: 1.6,
        }}
      >
        💡 <strong style={{ color: "#e4e4e7" }}>Recommended:</strong> Start with{" "}
        <strong style={{ color: "#a78bfa" }}>Small English</strong> — it gives the best speed/accuracy
        balance on your Intel Core Ultra 5 125H. For Hindi/Hinglish, download{" "}
        <strong style={{ color: "#a78bfa" }}>Large V3 Turbo</strong> and switch language to Auto or Hindi.
      </div>

      {/* Model cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {models.map((model) => {
          const isActive = activeModel === model.filename;
          const isDownloading = downloading === model.id;
          const status = downloadStatus[model.id];

          return (
            <div
              key={model.id}
              style={{
                background: "#111",
                border: `1px solid ${isActive ? "#7c3aed50" : "#1f1f1f"}`,
                borderRadius: "12px",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: "20px",
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: model.downloaded ? "#1a1a2e" : "#1a1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {model.downloaded ? (
                  <CheckCircle size={20} style={{ color: "#22d3ee" }} />
                ) : (
                  <Download size={20} style={{ color: "#52525b" }} />
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 600, color: "#fafafa" }}>
                    {model.name}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        background: "#7c3aed20",
                        border: "1px solid #7c3aed50",
                        borderRadius: "4px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        color: "#a78bfa",
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>{model.description}</p>
                <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#52525b" }}>
                    <HardDrive size={12} />
                    {formatSize(model.size_mb)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#52525b" }}>
                    <Cpu size={12} />
                    ~{formatSize(model.ram_mb)} RAM
                  </span>
                </div>
                {status && (
                  <p style={{ fontSize: "12px", color: isDownloading ? "#22d3ee" : "#71717a", margin: "4px 0 0" }}>
                    {status}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                {model.downloaded ? (
                  <>
                    {!isActive && (
                      <button
                        onClick={() => handleSetActive(model.filename)}
                        style={{
                          background: "#1a1a2e",
                          border: "1px solid #2a2a4a",
                          borderRadius: "7px",
                          padding: "8px 14px",
                          fontSize: "13px",
                          color: "#a78bfa",
                          cursor: "pointer",
                        }}
                      >
                        Set Active
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleDownload(model)}
                    disabled={isDownloading || !!downloading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: isDownloading ? "#1a1a1a" : "#7c3aed",
                      border: "none",
                      borderRadius: "7px",
                      padding: "8px 16px",
                      fontSize: "13px",
                      color: "#fff",
                      cursor: isDownloading || !!downloading ? "not-allowed" : "pointer",
                      opacity: !!downloading && !isDownloading ? 0.5 : 1,
                    }}
                  >
                    <Download size={14} />
                    {isDownloading ? "Downloading…" : `Download (${formatSize(model.size_mb)})`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
