# TTS Provider Setup Guide

This guide helps you configure a Text-to-Speech provider for Affirmation Beats V3.

## Quick Start

1. Choose a TTS provider (OpenAI recommended for simplicity)
2. Get your API key
3. Add it to `apps/api/.env`
4. Restart the API server

## Provider Options

### 1. OpenAI TTS (Recommended)

**Pros:**
- Simple setup
- Good quality voices
- Reasonable pricing
- Natural prosody control

**Setup:**
1. Get API key from https://platform.openai.com/api-keys
2. Add to `apps/api/.env`:
   ```
   TTS_PROVIDER=openai
   OPENAI_API_KEY=sk-your-key-here
   ```

**Voice Options:**
- `nova` (default) - Calm, neutral female voice
- `onyx` - Calm, neutral male voice
- `alloy`, `echo`, `fable`, `shimmer` - Other voice options

**Pricing:** ~$15 per 1M characters (very affordable for affirmations)

---

### 2. ElevenLabs TTS

**Pros:**
- Ultra-realistic voices
- Excellent emotional control
- Voice cloning available

**Setup:**
1. Get API key from https://elevenlabs.io/app/settings/api-keys
2. Add to `apps/api/.env`:
   ```
   TTS_PROVIDER=elevenlabs
   ELEVENLABS_API_KEY=your-key-here
   ```

**Note:** You'll need to update voice IDs in `apps/api/src/services/audio/tts.ts` (mapVoiceIdToElevenLabs function) with your actual ElevenLabs voice IDs.

**Pricing:** Free tier: 10,000 chars/month, Paid: $5/month for 30,000 chars

---

### 3. Azure Cognitive Services

**Pros:**
- Enterprise-grade
- Extensive language support
- Custom neural voices

**Setup:**
1. Create Azure Speech resource: https://portal.azure.com
2. Get your key and region
3. Add to `apps/api/.env`:
   ```
   TTS_PROVIDER=azure
   AZURE_SPEECH_KEY=your-key-here
   AZURE_SPEECH_REGION=your-region (e.g., eastus)
   ```

**Pricing:** Free tier: 5 hours/month, Paid: $1-16/hour

---

## Configuration File

Edit `apps/api/.env`:

```bash
# TTS Provider Selection
TTS_PROVIDER=openai  # Options: openai, elevenlabs, azure, beep

# OpenAI Configuration
OPENAI_API_KEY=sk-your-key-here

# ElevenLabs Configuration (if using)
# ELEVENLABS_API_KEY=your-key-here

# Azure Configuration (if using)
# AZURE_SPEECH_KEY=your-key-here
# AZURE_SPEECH_REGION=eastus
```

## Testing TTS Configuration

After configuring:

1. **Restart API server:**
   ```bash
   pnpm -C apps/api dev
   ```

2. **Create a test session** in the mobile app

3. **Generate audio** - The system will:
   - Use TTS if configured and working
   - Fall back to beeps if TTS fails or not configured

4. **Check API logs** for TTS status:
   - `[TTS] openai generating...` - TTS working
   - `[TTS] openai failed, falling back to beep` - TTS error, using fallback

## Troubleshooting

### TTS Not Working

1. **Check API key is set:**
   ```bash
   # In apps/api directory
   cat .env | grep API_KEY
   ```

2. **Verify provider selection:**
   ```bash
   cat .env | grep TTS_PROVIDER
   ```

3. **Check API logs** for error messages

4. **Test API key directly:**
   - OpenAI: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`
   - ElevenLabs: Check dashboard for usage/quota
   - Azure: Test in Azure portal

### Fallback to Beeps

If you see beeps instead of TTS:
- API key might be invalid
- Provider not configured correctly
- Rate limit exceeded
- Network error

Check API server logs for specific error messages.

## Voice Customization

To customize voices, edit `apps/api/src/services/audio/tts.ts`:

- **OpenAI:** Update `mapVoiceIdToOpenAI()` function
- **ElevenLabs:** Update `mapVoiceIdToElevenLabs()` with your voice IDs
- **Azure:** Update `mapVoiceIdToAzure()` with neural voice names

## Cost Optimization

For development/testing:
- Use OpenAI `tts-1` model (cheaper, still good quality)
- Use beep fallback for initial testing
- Cache is automatic (same text = no new API call)

For production:
- Consider `tts-1-hd` for higher quality
- Monitor API usage
- Set up rate limiting if needed
