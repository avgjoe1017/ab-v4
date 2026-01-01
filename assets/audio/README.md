# Audio Assets Directory

This directory contains the static audio assets used by the application:
- **Binaural beats** - Used for brainwave entrainment
- **Background sounds** - Ambient/looped background audio
- **Solfeggio frequencies** - Alternative to binaural beats

## Directory Structure

```
assets/audio/
├── binaural/          # Binaural beat files
│   └── Format: {brainwave}_{frequency}hz_{carrier}_3min.m4a
│   └── Example: alpha_10hz_400_3min.m4a
│
├── background/looped/ # Background ambient sounds
│   └── Format: {name}.m4a
│   └── Example: Babbling Brook.m4a
│
└── solfeggio/         # Solfeggio frequency files
    └── Format: solfeggio_{frequency}_3min.m4a
    └── Example: solfeggio_528_3min.m4a
```

## File Formats

All audio files should be:
- **Format**: M4A (MPEG-4 Audio)
- **Codec**: AAC
- **Duration**: Typically 3 minutes (looped)
- **Quality**: Optimized for streaming

## Expected Files

### Binaural Beats
The code expects files in the format: `{brainwave}_{hz}hz_{carrier}_3min.m4a`

Common brainwave states:
- `alpha` - Alpha waves (8-13 Hz)
- `beta` - Beta waves (14-30 Hz)
- `theta` - Theta waves (4-8 Hz)
- `delta` - Delta waves (0.5-4 Hz)
- `smr` - Sensorimotor rhythm (12-15 Hz)

Example files:
- `alpha_10hz_400_3min.m4a` (default)
- `beta_20hz_120_3min.m4a`
- `theta_6hz_400_3min.m4a`

### Background Sounds
Default background: `Babbling Brook.m4a`

Other common backgrounds (referenced in code):
- `Birds Chirping.m4a`
- `Distant Ocean.m4a`
- `Rain.m4a`
- `Forest.m4a`
- `Night.m4a`
- `Calm.m4a`

### Solfeggio Frequencies
Format: `solfeggio_{hz}_3min.m4a`

Common frequencies:
- 174 Hz
- 285 Hz
- 396 Hz
- 417 Hz
- 528 Hz
- 639 Hz
- 741 Hz
- 852 Hz
- 963 Hz

## Asset Serving

These assets are served in two ways:

1. **Local files** (for Android development):
   - Served via API endpoint: `/assets/audio/{type}/{filename}`
   - Path resolution: `assets/audio/` or `apps/assets/audio/`

2. **S3 storage** (for iOS and production):
   - Uploaded via `apps/api/scripts/upload-static-assets-to-s3.ts`
   - S3 key format: `audio/{type}/{filename}`
   - iOS uses S3 URLs to avoid App Transport Security (ATS) issues

## Adding New Assets

1. Place the audio file in the appropriate directory
2. Ensure the filename matches the expected format
3. For production, run the upload script:
   ```bash
   cd apps/api
   bun scripts/upload-static-assets-to-s3.ts
   ```

## Notes

- These directories are **not** in `.gitignore` by default
- Audio files may be large - consider using Git LFS if needed
- The code will fall back to S3 URLs if local files don't exist
- Default fallback: Alpha 10Hz binaural and "Babbling Brook" background
