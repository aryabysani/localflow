use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use tauri::State;

// 16 kHz * 10 seconds = 160,000 samples
const SAMPLE_RATE: u32 = 16000;
const BUFFER_CAPACITY: usize = 160_000;

pub struct AudioState {
    pub buffer: Mutex<VecDeque<f32>>,
    pub stream: Mutex<Option<cpal::Stream>>,
    pub is_recording: Mutex<bool>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            buffer: Mutex::new(VecDeque::with_capacity(BUFFER_CAPACITY)),
            stream: Mutex::new(None),
            is_recording: Mutex::new(false),
        }
    }
}

#[tauri::command]
pub fn start_audio_capture(state: State<'_, Arc<AudioState>>) -> Result<(), String> {
    let mut is_recording = state.is_recording.lock().unwrap();
    if *is_recording {
        return Err("Already recording".into());
    }

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device available")?;

    let mut supported_configs_range = device
        .supported_input_configs()
        .map_err(|e| e.to_string())?;

    // cpal 0.17 SampleRate is a type alias to u32
    let supported_config = supported_configs_range
        .find(|c| {
            let min_sr = c.min_sample_rate();
            let max_sr = c.max_sample_rate();
            min_sr <= SAMPLE_RATE && max_sr >= SAMPLE_RATE
        })
        .ok_or("No supported config for 16kHz found")?
        .with_sample_rate(SAMPLE_RATE as _);

    let sample_format = supported_config.sample_format();
    let config = supported_config.into();

    let state_clone = state.inner().clone();
    
    // Clear buffer on start
    state_clone.buffer.lock().unwrap().clear();

    let err_fn = |err| eprintln!("An error occurred on the input audio stream: {}", err);

    let stream = match sample_format {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config,
            move |data: &[f32], _: &_| {
                let mut buffer = state_clone.buffer.lock().unwrap();
                let channels = config.channels as usize;
                for frame in data.chunks(channels) {
                    let sum: f32 = frame.iter().sum();
                    let mono_sample = sum / channels as f32;
                    if buffer.len() == BUFFER_CAPACITY {
                        buffer.pop_front();
                    }
                    buffer.push_back(mono_sample);
                }
            },
            err_fn,
            None,
        ),
        _ => return Err("Only f32 sample format is currently supported".into()),
    }
    .map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;

    *state.stream.lock().unwrap() = Some(stream);
    *is_recording = true;

    Ok(())
}

#[tauri::command]
pub fn stop_audio_capture(state: State<'_, Arc<AudioState>>) -> Result<Vec<f32>, String> {
    let mut is_recording = state.is_recording.lock().unwrap();
    if !*is_recording {
        return Err("Not recording".into());
    }

    *state.stream.lock().unwrap() = None;
    *is_recording = false;

    let mut buffer = state.buffer.lock().unwrap();
    let data: Vec<f32> = buffer.drain(..).collect();

    Ok(data)
}
