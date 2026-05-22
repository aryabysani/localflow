use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use tauri::State;
use serde::Serialize;

// 16 kHz * 30 seconds = 480,000 samples max
pub const SAMPLE_RATE: u32 = 16000;
const BUFFER_CAPACITY: usize = 480_000;

#[derive(Default, Serialize, Clone)]
pub struct AudioAmplitude {
    pub rms: f32,
    pub bars: Vec<f32>,
}

pub struct AudioState {
    pub buffer: Mutex<VecDeque<f32>>,
    pub stream: Mutex<Option<cpal::Stream>>,
    pub is_recording: Mutex<bool>,
    pub amplitude: Mutex<AudioAmplitude>,
    pub device_name: Mutex<String>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            buffer: Mutex::new(VecDeque::with_capacity(BUFFER_CAPACITY)),
            stream: Mutex::new(None),
            is_recording: Mutex::new(false),
            amplitude: Mutex::new(AudioAmplitude::default()),
            device_name: Mutex::new(String::new()),
        }
    }
}

/// Internal function usable from pipeline without Tauri State wrapper
pub fn start_capture_internal(
    state: &Arc<AudioState>,
    device_name: Option<String>,
) -> Result<(), String> {
    let host = cpal::default_host();

    let device = if let Some(ref name) = device_name {
        host.input_devices()
            .map_err(|e| e.to_string())?
            .find(|d| d.name().map(|n| n == *name).unwrap_or(false))
            .ok_or_else(|| format!("Device '{}' not found", name))?
    } else {
        host.default_input_device()
            .ok_or("No input device available")?
    };

    if let Ok(name) = device.name() {
        *state.device_name.lock().unwrap() = name;
    }

    let mut configs_range = device
        .supported_input_configs()
        .map_err(|e| e.to_string())?;

    let supported_config = configs_range
        .find(|c| {
            c.min_sample_rate().0 <= SAMPLE_RATE && c.max_sample_rate().0 >= SAMPLE_RATE
        })
        .ok_or("No supported config for 16kHz found")?
        .with_sample_rate(cpal::SampleRate(SAMPLE_RATE));

    let channels = supported_config.channels() as usize;
    let config: cpal::StreamConfig = supported_config.into();

    // Clear buffer on start
    state.buffer.lock().unwrap().clear();

    let state_for_cb = state.clone();
    let err_fn = |err| eprintln!("Audio stream error: {}", err);

    let stream = device
        .build_input_stream(
            &config,
            move |data: &[f32], _: &_| {
                let mono_samples: Vec<f32> = data
                    .chunks(channels)
                    .map(|frame| frame.iter().sum::<f32>() / channels as f32)
                    .collect();

                // Compute amplitude bars (8 bars)
                let chunk_size = (mono_samples.len() / 8).max(1);
                let mut bars: Vec<f32> = mono_samples
                    .chunks(chunk_size)
                    .take(8)
                    .map(|chunk| {
                        let rms = (chunk.iter().map(|s| s * s).sum::<f32>()
                            / chunk.len() as f32)
                            .sqrt();
                        (rms * 8.0).min(1.0)
                    })
                    .collect();
                while bars.len() < 8 {
                    bars.push(0.05);
                }

                let rms = (mono_samples.iter().map(|s| s * s).sum::<f32>()
                    / mono_samples.len().max(1) as f32)
                    .sqrt();

                if let Ok(mut amp) = state_for_cb.amplitude.try_lock() {
                    amp.rms = rms;
                    amp.bars = bars;
                }

                let mut buffer = state_for_cb.buffer.lock().unwrap();
                for sample in mono_samples {
                    if buffer.len() == BUFFER_CAPACITY {
                        buffer.pop_front();
                    }
                    buffer.push_back(sample);
                }
            },
            err_fn,
            None,
        )
        .map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;

    *state.stream.lock().unwrap() = Some(stream);
    *state.is_recording.lock().unwrap() = true;

    Ok(())
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_audio_devices() -> Vec<String> {
    let host = cpal::default_host();
    match host.input_devices() {
        Ok(devices) => devices.filter_map(|d| d.name().ok()).collect(),
        Err(_) => vec![],
    }
}

#[tauri::command]
pub fn start_audio_capture(
    state: State<'_, Arc<AudioState>>,
    device_name: Option<String>,
) -> Result<(), String> {
    let is_rec = *state.is_recording.lock().unwrap();
    if is_rec {
        return Err("Already recording".into());
    }
    start_capture_internal(state.inner(), device_name)
}

#[tauri::command]
pub fn stop_audio_capture(state: State<'_, Arc<AudioState>>) -> Result<usize, String> {
    let mut is_recording = state.is_recording.lock().unwrap();
    if !*is_recording {
        return Err("Not recording".into());
    }
    *state.stream.lock().unwrap() = None;
    *is_recording = false;
    Ok(state.buffer.lock().unwrap().len())
}

#[tauri::command]
pub fn get_amplitude(state: State<'_, Arc<AudioState>>) -> AudioAmplitude {
    state.amplitude.lock().unwrap().clone()
}

#[tauri::command]
pub fn is_recording(state: State<'_, Arc<AudioState>>) -> bool {
    *state.is_recording.lock().unwrap()
}
