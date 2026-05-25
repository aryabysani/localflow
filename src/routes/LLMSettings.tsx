import { useEffect, useState } from "react";
import { Download, CheckCircle, Cpu, Play, Settings, AlertCircle, Sparkles } from "lucide-react";
import {
  listLlmModels,
  isLlamaCliInstalled,
  downloadLlamaCli,
  downloadLlmModel,
  getSetting,
  setSetting,
  LlmModelInfo,
} from "../lib/ipc";
import { invoke } from "@tauri-apps/api/core";

export default function LLMSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [cliInstalled, setCliInstalled] = useState(false);
  const [models, setModels] = useState<LlmModelInfo[]>([]);
  const [activeModel, setActiveModel] = useState("Llama-3.2-1B-Instruct-Q4_K_M.gguf");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showBanner, setShowBanner] = useState(() => {
    return localStorage.getItem("flowlocal_llm_banner_closed") !== "true";
  });

  const handleCloseBanner = () => {
    setShowBanner(false);
    localStorage.setItem("flowlocal_llm_banner_closed", "true");
  };
  
  // Action states
  const [downloadingCli, setDownloadingCli] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  
  // Test states
  const [testInput, setTestInput] = useState(
    "so um, yesterday i went to the office no i mean i went to the park and like it was raining uh you know"
  );
  const [testOutput, setTestOutput] = useState("");
  const [testingInference, setTestingInference] = useState(false);

  const loadData = async () => {
    try {
      const cliStatus = await isLlamaCliInstalled();
      setCliInstalled(cliStatus);
      
      const list = await listLlmModels();
      setModels(list);
      
      const dbEnabled = await getSetting("llm_enabled");
      setEnabled(dbEnabled === "true");

      const dbActive = await getSetting("llm_active_model");
      if (dbActive) setActiveModel(dbActive);

      const dbPrompt = await getSetting("llm_system_prompt");
      if (dbPrompt) setSystemPrompt(dbPrompt);
    } catch (e) {
      console.error("Failed to load LLM settings:", e);
    }
  };

  useEffect(() => {
    loadData().catch(console.error);
  }, []);

  const handleToggle = async () => {
    const nextVal = !enabled;
    setEnabled(nextVal);
    await setSetting("llm_enabled", nextVal ? "true" : "false");
  };

  const handleDownloadCli = async () => {
    setDownloadingCli(true);
    setStatusMessage("Downloading llama.cpp tools (AVX2)...");
    try {
      const res = await downloadLlamaCli();
      setStatusMessage(res);
      setCliInstalled(true);
      await loadData();
    } catch (e) {
      setStatusMessage(`Failed: ${e}`);
    } finally {
      setDownloadingCli(false);
    }
  };

  const handleDownloadModel = async (model: LlmModelInfo) => {
    setDownloadingModel(model.id);
    setStatusMessage(`Downloading ${model.name}...`);
    try {
      const res = await downloadLlmModel(model.id);
      setStatusMessage(res);
      await loadData();
    } catch (e) {
      setStatusMessage(`Failed: ${e}`);
    } finally {
      setDownloadingModel(null);
    }
  };

  const handleSetActiveModel = async (filename: string) => {
    setActiveModel(filename);
    await setSetting("llm_active_model", filename);
    setStatusMessage(`Selected ${filename} as active formatting model.`);
  };

  const handleSavePrompt = async () => {
    await setSetting("llm_system_prompt", systemPrompt);
    setStatusMessage("System instructions updated successfully.");
  };

  const handleTestInference = async () => {
    setTestingInference(true);
    setTestOutput("Formatting...");
    try {
      // Invoke llm inference command directly
      const result = await invoke<string>("cleanup_text", {
        rawText: testInput,
        appExe: "notion.exe"
      });
      setTestOutput(result);
    } catch (e) {
      setTestOutput(`Error: ${e}`);
    } finally {
      setTestingInference(false);
    }
  };

  const formatSize = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`);

  return (
    <div className="page">
      {showBanner && (
        <div className="banner-card" style={{ backgroundImage: "url('/Local LLM Background.png')" }}>
          <button className="banner-close" onClick={handleCloseBanner} aria-label="Close banner">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
          </button>
          <div className="banner-content">
            <h2 className="banner-title">Offline intelligence, natively <em>yours</em>.</h2>
            <p className="banner-desc">
              Format, capitalize, and transform voice dictation using local models that never touch the cloud.
            </p>
            <div className="banner-actions">
              <span className="banner-tag">Llama 3.2 1B</span>
              <span className="banner-tag">Qwen 2.5 0.5B</span>
              <span className="banner-tag">100% Offline</span>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <p className="page-kicker">Offline AI Formatting</p>
          <h2 className="page-title">Local LLM</h2>
        </div>
      </div>

      <section className="glass-panel" style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 className="section-title" style={{ margin: 0, fontSize: 15 }}>Enable Local LLM Cleanup</h3>
            <p className="row-desc" style={{ margin: "4px 0 0 0" }}>
              Formats transcripts using a local model to strip filler words, fix typos, and restructure tone offline.
            </p>
          </div>
          <button
            className={`switch ${enabled ? "on" : ""}`}
            onClick={handleToggle}
            aria-pressed={enabled}
          >
            <span />
          </button>
        </div>
      </section>

      {statusMessage && (
        <section className="glass-panel mac-callout" style={{ marginBottom: 18, borderColor: "var(--accent)" }}>
          <Sparkles size={16} color="var(--accent)" />
          <p className="row-desc" style={{ margin: 0, fontWeight: 500 }}>{statusMessage}</p>
        </section>
      )}

      {/* llama-cli setup */}
      <section className="section-label" style={{ marginBottom: 6 }}>1. Local LLM Binaries</section>
      <section className="glass-panel" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="row-title" style={{ fontSize: 14 }}>llama.cpp Inference Tools</span>
              {cliInstalled ? (
                <span className="badge success">Installed</span>
              ) : (
                <span className="badge warning">Missing</span>
              )}
            </div>
            <p className="row-desc" style={{ marginTop: 4, marginBottom: 0 }}>
              Windows AVX2 precompiled helper files (llama-cli.exe and llama.dll). Saves compile overhead.
            </p>
          </div>
          <div>
            {!cliInstalled ? (
              <button
                className="button primary"
                disabled={downloadingCli}
                onClick={handleDownloadCli}
              >
                <Download size={14} />
                {downloadingCli ? "Downloading..." : "Download (15 MB)"}
              </button>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--success)", fontSize: 13, fontWeight: 500 }}>
                <CheckCircle size={15} /> Ready
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Model Download List */}
      <section className="section-label" style={{ marginBottom: 6 }}>2. Select Formatting Model</section>
      <section className="grid" style={{ marginBottom: 18 }}>
        {models.map((model) => {
          const isActive = activeModel === model.filename;
          const isDownloading = downloadingModel === model.id;

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
                    <Cpu size={13} />
                    Size: {formatSize(model.size_mb)}
                  </span>
                </div>
              </div>

              <div>
                {model.downloaded ? (
                  !isActive && (
                    <button className="button" onClick={() => handleSetActiveModel(model.filename)}>
                      Select
                    </button>
                  )
                ) : (
                  <button
                    className="button primary"
                    disabled={isDownloading || !!downloadingModel}
                    onClick={() => handleDownloadModel(model)}
                  >
                    <Download size={14} />
                    {isDownloading ? "Downloading" : `Download ${formatSize(model.size_mb)}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* System Prompt Customization */}
      <section className="section-label" style={{ marginBottom: 6 }}>3. Instructions Customization</section>
      <section className="glass-panel" style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0, fontSize: 14 }}>System Instructions Override</h3>
          <p className="row-desc" style={{ marginTop: 4, marginBottom: 8 }}>
            Customize the behavior of the text post-processor. Empty defaults to standard dictation rules (paragraphs, list formatting, capitalization).
          </p>
          <textarea
            className="select"
            style={{ width: "100%", height: 75, padding: 8, fontFamily: "inherit", resize: "none", fontSize: 13 }}
            placeholder="e.g. Translate speech to French, structure output as Markdown bullet points, etc."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="button" onClick={handleSavePrompt}>
            <Settings size={14} /> Save instructions
          </button>
        </div>
      </section>

      {/* Test Inference area */}
      <section className="section-label" style={{ marginBottom: 6 }}>4. Live Playground</section>
      <section className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <span className="setting-title" style={{ display: "block", marginBottom: 6 }}>Raw Transcript Input</span>
            <textarea
              className="select"
              style={{ width: "100%", height: 110, padding: 8, resize: "none", fontSize: 13 }}
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
            />
          </div>
          <div>
            <span className="setting-title" style={{ display: "block", marginBottom: 6 }}>Processed Output</span>
            <div
              style={{
                width: "100%",
                height: 110,
                padding: 8,
                borderRadius: 6,
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--separator-soft)",
                fontSize: 13,
                overflowY: "auto",
                whiteSpace: "pre-wrap"
              }}
            >
              {testOutput || <span style={{ color: "var(--secondary)" }}>Output will appear here...</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--separator-soft)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--secondary)" }}>
            <AlertCircle size={14} />
            <span style={{ fontSize: 11 }}>Requires Local LLM enabled, llama-cli, and active model downloaded.</span>
          </div>
          <button
            className="button primary"
            disabled={testingInference || !cliInstalled || !enabled}
            onClick={handleTestInference}
          >
            <Play size={13} />
            {testingInference ? "Formatting..." : "Run Test"}
          </button>
        </div>
      </section>
    </div>
  );
}
