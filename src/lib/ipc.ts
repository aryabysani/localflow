import { invoke } from "@tauri-apps/api/core";

// Type-safe Tauri invoke wrappers

export async function getAmplitude() {
  return invoke<{ rms: number; bars: number[] }>("get_amplitude");
}

export async function startRecording(deviceName?: string) {
  return invoke<void>("start_audio_capture", { deviceName });
}

export async function stopRecording() {
  return invoke<number>("stop_audio_capture");
}

export async function transcribeAudio(language?: string, initialPrompt?: string) {
  return invoke<string>("transcribe_audio", { language, initialPrompt });
}

export async function listModels() {
  return invoke<ModelInfo[]>("list_models");
}

export async function downloadModel(modelId: string) {
  return invoke<string>("download_model", { modelId });
}

export async function setActiveModel(filename: string) {
  return invoke<void>("set_active_model", { filename });
}

export async function getDashboardStats() {
  return invoke<DashboardStats>("get_dashboard_stats");
}

export async function getHistory(search?: string, limit?: number, offset?: number) {
  return invoke<DictationEntry[]>("get_history", { search, limit, offset });
}

export async function deleteHistoryEntry(id: number) {
  return invoke<void>("delete_history_entry", { id });
}

export async function clearHistory() {
  return invoke<void>("clear_history");
}

export async function getDictionary() {
  return invoke<DictionaryEntry[]>("get_dictionary");
}

export async function addDictionaryEntry(term: string, pronunciation: string, replacement: string) {
  return invoke<number>("add_dictionary_entry", { term, pronunciation, replacement });
}

export async function deleteDictionaryEntry(id: number) {
  return invoke<void>("delete_dictionary_entry", { id });
}

export async function getSetting(key: string) {
  return invoke<string | null>("get_setting", { key });
}

export async function setSetting(key: string, value: string) {
  return invoke<void>("set_setting", { key, value });
}

export async function getAllSettings() {
  return invoke<Record<string, string>>("get_all_settings");
}

export async function listAudioDevices() {
  return invoke<string[]>("list_audio_devices");
}

export async function getNotes() {
  return invoke<Note[]>("get_notes");
}

export async function saveNote(id: string, title: string, content: string, folder: string) {
  return invoke<void>("save_note", { id, title, content, folder });
}

export async function deleteNote(id: string) {
  return invoke<void>("delete_note", { id });
}

export async function getForegroundApp() {
  return invoke<[string, string]>("get_foreground_app");
}

export async function togglePrivacyMode() {
  return invoke<boolean>("toggle_privacy_mode");
}

// Types
export interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  url: string;
  size_mb: number;
  ram_mb: number;
  description: string;
  downloaded: boolean;
  size_on_disk: number;
}

export interface DashboardStats {
  total_words: number;
  words_today: number;
  avg_wpm_7d: number;
  streak_days: number;
  total_dictations: number;
  time_saved_minutes: number;
  words_per_day: WordsPerDay[];
  top_apps: AppUsage[];
}

export interface WordsPerDay {
  date: string;
  words: number;
  wpm: number;
}

export interface AppUsage {
  app_name: string;
  word_count: number;
  dictation_count: number;
}

export interface DictationEntry {
  id: number;
  timestamp: string;
  app_name: string;
  app_exe: string;
  raw_text: string;
  cleaned_text: string;
  word_count: number;
  duration_secs: number;
  language: string;
}

export interface DictionaryEntry {
  id: number;
  term: string;
  pronunciation: string;
  replacement: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  created_at: string;
  updated_at: string;
}
