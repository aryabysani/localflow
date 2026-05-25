use std::f32::consts::PI;
use std::sync::OnceLock;
use windows::core::PCWSTR;
use windows::Win32::Media::Audio::{PlaySoundW, SND_ASYNC, SND_MEMORY, SND_NODEFAULT};

static START_WAV: OnceLock<Vec<u8>> = OnceLock::new();
static STOP_WAV: OnceLock<Vec<u8>> = OnceLock::new();
static CANCEL_WAV: OnceLock<Vec<u8>> = OnceLock::new();

fn generate_wav_sweep(start_freq: f32, end_freq: f32, duration_ms: u32, sample_rate: u32) -> Vec<u8> {
    let num_samples = (sample_rate as f32 * (duration_ms as f32 / 1000.0)) as usize;
    let mut data = Vec::with_capacity(num_samples * 2);
    
    let duration_secs = duration_ms as f32 / 1000.0;
    
    for i in 0..num_samples {
        let t = i as f32 / sample_rate as f32;
        
        // Linear frequency sweep:
        let phase = 2.0 * PI * (start_freq * t + 0.5 * (end_freq - start_freq) * t * t / duration_secs);
        let mut sample = phase.sin();
        
        // Smooth window/envelope (15ms fade-in, 30ms fade-out)
        let fade_in_samples = (sample_rate as f32 * 0.015) as usize;
        let fade_out_samples = (sample_rate as f32 * 0.030) as usize;
        
        if i < fade_in_samples {
            let fade = i as f32 / fade_in_samples as f32;
            sample *= fade;
        } else if i > num_samples - fade_out_samples {
            let fade = (num_samples - i) as f32 / fade_out_samples as f32;
            sample *= fade;
        }
        
        // 16-bit signed integer scaling
        let int_sample = (sample * 14000.0) as i16;
        data.extend_from_slice(&int_sample.to_le_bytes());
    }
    
    // WAV Header
    let data_len = data.len() as u32;
    let mut wav = Vec::with_capacity(44 + data.len());
    
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes()); // AudioFormat PCM = 1
    wav.extend_from_slice(&1u16.to_le_bytes()); // Mono = 1
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    
    let bits_per_sample = 16u16;
    let byte_rate = sample_rate * 1 * (bits_per_sample as u32) / 8;
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    
    let block_align = 1 * bits_per_sample / 8;
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&bits_per_sample.to_le_bytes());
    
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    wav.extend(data);
    
    wav
}

pub fn play_start_sound() {
    let wav = START_WAV.get_or_init(|| {
        generate_wav_sweep(523.25, 659.25, 120, 22050)
    });
    play_sound_bytes(wav);
}

pub fn play_stop_sound() {
    let wav = STOP_WAV.get_or_init(|| {
        generate_wav_sweep(659.25, 523.25, 120, 22050)
    });
    play_sound_bytes(wav);
}

pub fn play_cancel_sound() {
    let wav = CANCEL_WAV.get_or_init(|| {
        generate_wav_sweep(400.0, 200.0, 150, 22050)
    });
    play_sound_bytes(wav);
}

fn play_sound_bytes(bytes: &[u8]) {
    unsafe {
        let pcwstr = PCWSTR::from_raw(bytes.as_ptr() as *const u16);
        let flags = SND_MEMORY | SND_ASYNC | SND_NODEFAULT;
        let _ = PlaySoundW(pcwstr, None, flags);
    }
}
