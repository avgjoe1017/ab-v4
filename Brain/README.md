# Brain - Knowledge Base

This folder contains all the knowledge and documentation needed to create affirmations, beats, and the overall audio experience for Affirmation Beats V3.

## 📚 Documentation Index

### Core Affirmation Knowledge

1. **`affirmation_rules.md`** - The definitive guide for writing effective affirmations
   - 5 Linguistic Commandments
   - 3 Frameworks (Bridge, Value Anchor, Power Statement)
   - Quality control checklist
   - Based on Self-Affirmation Theory and neuroplasticity research

2. **`100 Affirmations.md`** - Curated examples of effective affirmations
   - Categorized by use case (anxiety, resilience, self-worth, etc.)
   - Examples that follow the rules in `affirmation_rules.md`
   - Reference for tone, structure, and phrasing

3. **`affirmation_research.md`** - Scientific research on binaural beats and solfeggio frequencies
   - Mechanisms of action
   - Brainwave states and frequency ranges
   - Use case mappings
   - Scientific evidence vs anecdotal claims

### Audio Experience & Delivery

4. **`Loop-and-delivery.md`** - **CRITICAL** - The authoritative delivery pattern
   - Each affirmation is spoken twice (first read, second read with variation)
   - Silence occurs only after the second read
   - All sessions loop infinitely
   - Pace is fixed and slow
   - This is a product invariant - any implementation must follow this

5. **`ab-v3-audio-experience-implementation-spec.md`** - Audio technical specifications
   - Audio formats and standards
   - Loudness targets (LUFS, true peak)
   - Loop readiness rules
   - Voice activity detection
   - Ducking and mix automation

6. **`AFFIRMATION_PIPELINE_AND_PLAYER.md`** - Complete technical pipeline documentation
   - Affirmation generation flow
   - TTS integration details
   - Audio stitching process
   - Player architecture
   - Code references and implementation details

### Product & UX Guidelines

7. **`affirmation_beats_ux_roadmap.md`** - Product principles and UX roadmap
   - North star and product principles
   - Information architecture
   - Phase-by-phase deliverables
   - Interaction patterns

8. **`ROADMAP_CONTENT_AND_AI.md`** - Content and AI integration roadmap
   - AI affirmation generation pipeline
   - TTS integration
   - Content personalization
   - Future enhancements

## 🎯 Quick Reference

### When creating affirmations:
1. Read `affirmation_rules.md` for the rules
2. Check `100 Affirmations.md` for examples
3. Follow the delivery pattern in `Loop-and-delivery.md`

### When working with audio:
1. Follow `Loop-and-delivery.md` for the delivery pattern
2. Reference `ab-v3-audio-experience-implementation-spec.md` for technical specs
3. See `AFFIRMATION_PIPELINE_AND_PLAYER.md` for implementation details

### When choosing frequencies:
1. Check `affirmation_research.md` for binaural/solfeggio mappings
2. Use research-based frequency recommendations for different goals

## 🔍 How to Use This Knowledge Base

When the AI needs to:
- **Generate affirmations**: Check `affirmation_rules.md` and `100 Affirmations.md`
- **Understand delivery pattern**: Read `Loop-and-delivery.md` (this is authoritative)
- **Set audio levels**: Reference `ab-v3-audio-experience-implementation-spec.md`
- **Choose frequencies**: Use `affirmation_research.md` for mappings
- **Understand the pipeline**: See `AFFIRMATION_PIPELINE_AND_PLAYER.md`

## 📝 Notes

- `Loop-and-delivery.md` contains **locked product rules** - these are invariants
- All affirmations must follow the rules in `affirmation_rules.md`
- Audio specs in `ab-v3-audio-experience-implementation-spec.md` are enforced server-side
- Research in `affirmation_research.md` informs frequency selection but effects are mixed/emerging

