import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface AppState {
  isRecording: boolean;
  isProcessing: boolean;
  privacyMode: boolean;
  language: string;
  lastTranscript: { raw: string; cleaned: string } | null;
  amplitude: { rms: number; bars: number[] };

  setIsRecording: (v: boolean) => void;
  setIsProcessing: (v: boolean) => void;
  setPrivacyMode: (v: boolean) => void;
  setLanguage: (v: string) => void;
  setLastTranscript: (t: { raw: string; cleaned: string } | null) => void;
  setAmplitude: (a: { rms: number; bars: number[] }) => void;

  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  togglePrivacy: () => Promise<void>;
  initListeners: () => Promise<() => void>;
}

export const useAppStore = create<AppState>((set) => ({
  isRecording: false,
  isProcessing: false,
  privacyMode: false,
  language: "en",
  lastTranscript: null,
  amplitude: { rms: 0, bars: Array(8).fill(0.1) },

  setIsRecording: (v) => set({ isRecording: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setPrivacyMode: (v) => set({ privacyMode: v }),
  setLanguage: (v) => {
    set({ language: v });
    invoke("set_language", { language: v }).catch(console.error);
  },
  setLastTranscript: (t) => set({ lastTranscript: t }),
  setAmplitude: (a) => set({ amplitude: a }),

  startRecording: async () => {
    try {
      await invoke("start_recording_cmd");
      set({ isRecording: true });
    } catch (e) {
      console.error("Start recording failed:", e);
    }
  },

  stopRecording: async () => {
    try {
      set({ isProcessing: true, isRecording: false });
      const result = await invoke<{
        raw: string;
        cleaned: string;
        word_count: number;
        app_name: string;
      }>("stop_and_transcribe_cmd");
      set({
        isProcessing: false,
        lastTranscript: { raw: result.raw, cleaned: result.cleaned },
      });
    } catch (e) {
      console.error("Stop recording failed:", e);
      set({ isProcessing: false });
    }
  },

  togglePrivacy: async () => {
    const newMode = await invoke<boolean>("toggle_privacy_mode");
    set({ privacyMode: newMode });
  },

  initListeners: async () => {
    const unlisten1 = await listen("recording-started", () => {
      set({ isRecording: true });
    });
    const unlisten2 = await listen("recording-stopped", () => {
      set({ isRecording: false });
    });
    const unlisten3 = await listen("processing-started", () => {
      set({ isProcessing: true });
    });
    const unlisten4 = await listen<{ raw?: string; cleaned?: string; error?: string }>(
      "processing-done",
      (event) => {
        set({ isProcessing: false });
        if (event.payload.cleaned) {
          set({
            lastTranscript: {
              raw: event.payload.raw || "",
              cleaned: event.payload.cleaned,
            },
          });
        }
      }
    );

    return () => {
      unlisten1();
      unlisten2();
      unlisten3();
      unlisten4();
    };
  },
}));
