# Brain Track Mapping Rules

**Created**: 2026-01-01  
**Purpose**: Define which binaural beats and solfeggio frequencies should be paired with which session types  
**Source**: Brain folder research documents, available audio assets

---

## Overview

This document establishes the rules for automatically selecting brain tracks (binaural beats or solfeggio frequencies) based on session type and user intent. These mappings are derived from:

1. **Neuroscience research** on brainwave entrainment (see `affirmation_research.md`)
2. **V3 audio spec** requirements (`ab-v3-audio-experience-implementation-spec.md`)
3. **Available audio assets** in `assets/audio/binaural/` and `assets/audio/solfeggio/`

---

## Brainwave Frequency Bands (Reference)

| Band   | Frequency Range | Mental State                              | Use Case                           |
|--------|-----------------|-------------------------------------------|------------------------------------|
| Delta  | 0.5–4 Hz        | Deep sleep, unconscious healing           | Sleep, physical recovery           |
| Theta  | 4–7 Hz          | Light sleep, deep meditation, creativity  | Meditation, anxiety relief, REM    |
| Alpha  | 8–12 Hz         | Relaxed wakefulness, calm focus           | Stress relief, light meditation    |
| SMR    | 12–15 Hz        | Calm attention, motor stillness           | Focus without agitation            |
| Beta   | 13–30 Hz        | Alert, focused, active thinking           | Work, studying, energy             |
| Gamma  | 30–100 Hz       | Intense cognition, peak focus             | Advanced focus, memory             |

---

## Session Type → Brain Track Mappings

### Primary Mappings (Binaural Beats)

| Session Type      | Primary Binaural | Frequency | Rationale                                           |
|-------------------|------------------|-----------|-----------------------------------------------------|
| **Sleep**         | `delta_2hz`      | 2 Hz      | Promotes deep delta sleep, slow-wave restoration    |
| **Meditate**      | `alpha_10hz`     | 10 Hz     | Classic relaxed awareness, standard meditation      |
| **Focus**         | `smr_13.5hz`     | 13.5 Hz   | SMR band: calm concentration without agitation      |
| **Anxiety Relief**| `theta_7hz`      | 7 Hz      | Theta calms the mind, reduces anxious rumination    |
| **Wake Up**       | `beta_20hz`      | 20 Hz     | High beta for alertness and energy                  |
| **Pre-Performance**| `alpha_12hz`    | 12 Hz     | High alpha for calm confidence before action        |
| **Creativity**    | `theta_7hz`      | 7 Hz      | Theta-alpha border promotes creative insight        |
| **Coffee Replacement**| `beta_high_21.5hz` | 21.5 Hz | High beta mimics caffeine's alerting effect      |

### Alternative Options (for variety/personalization)

| Session Type      | Alternatives                              |
|-------------------|-------------------------------------------|
| **Sleep**         | `delta_1hz`, `delta_3hz`, `delta_4hz`     |
| **Meditate**      | `theta_8hz`, `alpha_12hz`                 |
| **Focus**         | `beta_13hz`, `beta_low_17hz`              |
| **Anxiety Relief**| `theta_4hz`, `alpha_10hz`                 |
| **Wake Up**       | `beta_high_21.5hz`, `gamma_38hz`          |
| **Pre-Performance**| `smr_13.5hz`, `alpha_10hz`               |
| **Creativity**    | `theta_4hz`, `theta_8hz`                  |
| **Coffee Replacement**| `beta_20hz`, `gamma_40hz`             |

---

## Solfeggio Frequency Mappings

Solfeggio frequencies are single-tone frequencies from sacred music traditions. They don't require stereo/headphones and appeal to users interested in holistic/spiritual approaches.

| Session Type       | Primary Solfeggio | Frequency | Traditional Association                    |
|--------------------|-------------------|-----------|-------------------------------------------|
| **Sleep**          | `solfeggio_528`   | 528 Hz    | "Miracle tone" - reduces cortisol, promotes rest |
| **Meditate**       | `solfeggio_432`   | 432 Hz    | Harmonic, peaceful, grounding             |
| **Focus**          | `solfeggio_741`   | 741 Hz    | Mental clarity, problem-solving           |
| **Anxiety Relief** | `solfeggio_396`   | 396 Hz    | Releases fear and guilt                   |
| **Wake Up**        | `solfeggio_417`   | 417 Hz    | Facilitates change, clears negativity     |
| **Pre-Performance**| `solfeggio_639`   | 639 Hz    | Harmonious relationships, confidence      |
| **Creativity**     | `solfeggio_852`   | 852 Hz    | Spiritual awareness, intuition            |
| **Deep Healing**   | `solfeggio_174`   | 174 Hz    | Foundation, pain/stress relief            |
| **Restoration**    | `solfeggio_285`   | 285 Hz    | Tissue regeneration, rejuvenation         |
| **Transcendence**  | `solfeggio_963`   | 963 Hz    | Pineal activation, higher consciousness   |

---

## Available Audio Assets

### Binaural Beats (`assets/audio/binaural/`)

| File Name                        | Beat Hz | Carrier Hz | Notes                    |
|----------------------------------|---------|------------|--------------------------|
| `alpha_10hz_400_3min.m4a`        | 10      | 400        | Default meditation       |
| `alpha_12hz_120_3min.m4a`        | 12      | 120        | Pre-performance          |
| `alpha_12hz_12hz_400_3min.m4a`   | 12      | 400        | Pre-performance (alt)    |
| `beta_13hz_400_3min.m4a`         | 13      | 400        | Light focus              |
| `beta_20hz_120_3min.m4a`         | 20      | 120        | Wake up / energy         |
| `beta_high_21.5hz_400_3min.m4a`  | 21.5    | 400        | Coffee replacement       |
| `beta_low_17hz_400_3min.m4a`     | 17      | 400        | Moderate focus           |
| `delta_1hz_100_3min.m4a`         | 1       | 100        | Very deep sleep          |
| `delta_2hz_120_3min.m4a`         | 2       | 120        | Deep sleep (primary)     |
| `delta_3hz_400_3min.m4a`         | 3       | 400        | Deep sleep               |
| `delta_4hz_400_3min.m4a`         | 4       | 400        | Light delta / deep theta |
| `gamma_38hz_100_3min.m4a`        | 38      | 100        | Peak focus               |
| `gamma_40hz_120_3min.m4a`        | 40      | 120        | Cognitive enhancement    |
| `gamma_42hz_400_3min.m4a`        | 42      | 400        | Peak performance         |
| `smr_13.5hz_400_3min.m4a`        | 13.5    | 400        | SMR - calm focus         |
| `theta_4hz_400_3min.m4a`         | 4       | 400        | Deep meditation          |
| `theta_7hz_400_3min.m4a`         | 7       | 400        | Meditation / anxiety     |
| `theta_8hz_120_3min.m4a`         | 8       | 120        | Alpha-theta border       |

### Solfeggio Frequencies (`assets/audio/solfeggio/`)

| File Name                    | Frequency | Purpose                        |
|------------------------------|-----------|--------------------------------|
| `solfeggio_174_3min.m4a`     | 174 Hz    | Pain relief, grounding         |
| `solfeggio_285_3min.m4a`     | 285 Hz    | Tissue healing                 |
| `solfeggio_396_3min.m4a`     | 396 Hz    | Liberating guilt/fear          |
| `solfeggio_417_3min.m4a`     | 417 Hz    | Facilitating change            |
| `solfeggio_432_3min.m4a`     | 432 Hz    | Harmony, meditation            |
| `solfeggio_528_3min.m4a`     | 528 Hz    | Love/miracle tone, sleep       |
| `solfeggio_639_3min.m4a`     | 639 Hz    | Relationships, harmony         |
| `solfeggio_741_3min.m4a`     | 741 Hz    | Mental clarity, expression     |
| `solfeggio_852_3min.m4a`     | 852 Hz    | Intuition, spiritual awareness |
| `solfeggio_963_3min.m4a`     | 963 Hz    | Divine consciousness           |
| `solfeggio_40_3min.m4a`      | 40 Hz     | Gamma-equivalent (cognitive)   |

---

## Implementation: Default Brain Track Selection

### Algorithm

```typescript
function getDefaultBrainTrack(
  sessionType: string,
  mode: "binaural" | "solfeggio" = "binaural"
): { hz: number; file: string } {
  
  const type = sessionType.toLowerCase();
  
  if (mode === "binaural") {
    // Binaural beat selection
    if (type.includes("sleep")) {
      return { hz: 2, file: "delta_2hz_120_3min.m4a" };
    }
    if (type.includes("focus") || type.includes("work") || type.includes("study")) {
      return { hz: 13.5, file: "smr_13.5hz_400_3min.m4a" };
    }
    if (type.includes("anxiety") || type.includes("calm")) {
      return { hz: 7, file: "theta_7hz_400_3min.m4a" };
    }
    if (type.includes("wake") || type.includes("morning") || type.includes("energy")) {
      return { hz: 20, file: "beta_20hz_120_3min.m4a" };
    }
    if (type.includes("performance") || type.includes("confidence")) {
      return { hz: 12, file: "alpha_12hz_120_3min.m4a" };
    }
    if (type.includes("creative") || type.includes("creativity")) {
      return { hz: 7, file: "theta_7hz_400_3min.m4a" };
    }
    if (type.includes("coffee") || type.includes("alertness")) {
      return { hz: 21.5, file: "beta_high_21.5hz_400_3min.m4a" };
    }
    // Default: Meditate / general → Alpha 10Hz
    return { hz: 10, file: "alpha_10hz_400_3min.m4a" };
    
  } else {
    // Solfeggio selection
    if (type.includes("sleep")) {
      return { hz: 528, file: "solfeggio_528_3min.m4a" };
    }
    if (type.includes("focus")) {
      return { hz: 741, file: "solfeggio_741_3min.m4a" };
    }
    if (type.includes("anxiety") || type.includes("fear")) {
      return { hz: 396, file: "solfeggio_396_3min.m4a" };
    }
    if (type.includes("wake") || type.includes("change")) {
      return { hz: 417, file: "solfeggio_417_3min.m4a" };
    }
    if (type.includes("creative") || type.includes("intuition")) {
      return { hz: 852, file: "solfeggio_852_3min.m4a" };
    }
    // Default: Meditate / general → 432Hz
    return { hz: 432, file: "solfeggio_432_3min.m4a" };
  }
}
```

---

## Intent-Based Override Rules

When the user provides a specific intent/goal, the brain track can be adjusted:

| Intent Keywords                          | Override To                      |
|------------------------------------------|----------------------------------|
| "can't sleep", "insomnia", "rest"        | Delta 2Hz or Solfeggio 528Hz     |
| "anxious", "worried", "panic", "stress"  | Theta 7Hz or Solfeggio 396Hz     |
| "focus", "concentrate", "work", "study"  | SMR 13.5Hz or Solfeggio 741Hz    |
| "tired", "exhausted", "need energy"      | Beta 20Hz or Solfeggio 417Hz     |
| "creative", "ideas", "brainstorm"        | Theta 7Hz or Solfeggio 852Hz     |
| "confidence", "presentation", "perform"  | Alpha 12Hz or Solfeggio 639Hz    |

---

## Scientific Notes

### Binaural Beats
- Require stereo headphones (left/right ear receive different frequencies)
- Carrier frequency kept at 100-400 Hz for optimal perception
- Difference frequency (the "beat") should be under 40 Hz
- Evidence for brainwave entrainment is promising but mixed (see research doc)
- Effects are subtle; best used as one component of a calming session

### Solfeggio Frequencies
- Do NOT require headphones (single tone)
- Less scientific evidence than binaural beats
- Strong appeal to users interested in holistic/spiritual approaches
- The 528 Hz frequency has the most preliminary research support (reduced cortisol in studies)
- Best used as an alternative option for users who prefer them or don't have headphones

---

## Product Defaults

1. **Default Mode**: Binaural (when audioConfig.brainTrackMode is not set)
2. **Default Frequency**: Alpha 10Hz (when session type is unknown or "Meditate")
3. **Fallback**: If requested frequency asset is missing, fall back to Alpha 10Hz

---

## Future Enhancements

1. **User Preference Learning**: Track which brain tracks users prefer, adjust defaults
2. **Time-of-Day Adjustment**: Morning → higher frequency, Evening → lower frequency
3. **Progressive Sessions**: Start with alpha, gradually move to theta/delta
4. **A/B Testing**: Test different mappings to optimize engagement/completion
