export const AUDIO_PROFILE_V3 = {
    // Processing intermediate format
    INTERMEDIATE_CODEC: "wav",
    INTERMEDIATE_SAMPLE_RATE_HZ: 48000,
    INTERMEDIATE_BIT_DEPTH: 24,
    
    // Final shipping format (AAC .m4a for gapless playback)
    CODEC: "aac",
    CONTAINER: "m4a",
    BITRATE_KBEPS: 192, // VBR or CBR - for voice/affirmations (needs clarity)
    SAMPLE_RATE_HZ: 48000,
    CHANNELS: 2, // Stereo
    
    // Optimized profiles for different content types
    BACKGROUND_BITRATE_KBEPS: 96, // Lower bitrate for ambient/background (less complex audio)
    BINAURAL_BITRATE_KBEPS: 96, // Lower bitrate for tones (very simple audio)
    
    // Legacy MP3 support (for backward compatibility during transition)
    LEGACY_CODEC: "mp3",
    LEGACY_BITRATE_KBEPS: 128,
    LEGACY_SAMPLE_RATE_HZ: 44100,
    
    VERSION: "v3_1_0", // Bumped for audio experience improvements
} as const;

export const SILENCE_DURATIONS_MS = [
    250,
    500,
    1000,
    1500,
    2000,
    3000,
    4000,
    5000,
    6000,
    7000,
    8000,
    9000,
    10000,
    11000,
    12000,
    13000,
    14000,
    15000,
] as const;

export type AudioProfileV3 = typeof AUDIO_PROFILE_V3;
export type SilenceDurationMs = (typeof SILENCE_DURATIONS_MS)[number];
