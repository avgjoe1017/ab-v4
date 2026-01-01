# Prompt Caching Implementation for Affirmation Generation

**Date**: 2025-01-14  
**Status**: ✅ Complete

## Overview

This document describes the implementation of OpenAI Prompt Caching for the affirmation generation service. Prompt caching reduces API costs and latency by caching the static portion of prompts (rules, schema, examples) while keeping user-specific content (values, struggle, session type) dynamic.

## Architecture

### Static Prefix (Cached)
The static prefix contains all content that is identical across requests:
- The 5 Linguistic Commandments (Cognitive Now, Exclusive Positivity, Verbs Over Adjectives, Brevity/Rhythm, Specificity/Plausibility)
- The 3 Frameworks (Bridge, Value Anchor, Power Statement)
- Session type guidelines
- Quality control checklist
- Output format rules (JSON only, no commentary)
- Examples of good/bad affirmations

**Location**: `apps/api/src/prompts/affirmations.generator.v2.txt`

### Dynamic Tail (Not Cached)
The dynamic tail contains user-specific content that changes per request:
- User's core values
- User's struggle/goal
- Session type (Focus, Sleep, Meditate, etc.)
- Count of affirmations to generate

**Location**: Built dynamically in `buildDynamicTail()` function

## Configuration

### Cache Key
- Format: `affirmations:generator:v{version}`
- Current: `affirmations:generator:v2`
- **Important**: Bump version when static prefix changes

### Template Versions
- **v1**: Basic rules and examples (deprecated)
- **v2**: Neuroscience-based rules with 5 Linguistic Commandments and 3 Frameworks

### Retention Policy
- **Current**: `24h` (extended retention)
- **Alternative**: `in_memory` (5-10 minutes, up to 1 hour)
- Extended retention requires models like `gpt-4.1` or GPT-5 variants

### Model Selection
- **Default**: `gpt-4o` (supports prompt caching)
- **Extended Retention**: `gpt-4.1` (supports 24h retention)
- **Configurable**: Set `OPENAI_MODEL` environment variable

## Implementation Details

### API Method
Uses OpenAI SDK `client.responses.create()` method (Responses API).

### Structured Output
JSON Schema enforces structured output:
```json
{
  "affirmations": ["string", ...]
}
```

### Performance Monitoring
Logs the following metrics on every request:
- `cached_tokens`: Number of tokens served from cache
- `input_tokens`: Total input tokens
- `output_tokens`: Total output tokens
- `latency_ms`: Request latency in milliseconds
- Cache hit rate: `(cached_tokens / input_tokens) * 100`

## Cache Performance

### Expected Behavior
1. **First Request** (Cold Start):
   - `cached_tokens = 0`
   - Full latency (no cache benefit)
   - Cache is populated for future requests

2. **Subsequent Requests** (Cache Hit):
   - `cached_tokens > 0` (often most of static prefix)
   - Reduced latency
   - Lower cost (cached tokens are cheaper)

### Troubleshooting

If `cached_tokens` stays at 0:

1. **Check Token Count**: Caching only activates for prompts ≥ 1024 tokens
2. **Verify Prefix Consistency**: Static prefix must be byte-for-byte identical
3. **Check Cache Key**: Ensure `prompt_cache_key` is consistent across requests
4. **Verify Model**: Ensure model supports prompt caching (`gpt-4o` or newer)
5. **Check Dynamic Content**: Ensure dynamic content is in the tail, not prefix

## File Structure

```
apps/api/src/
├── prompts/
│   ├── affirmations.generator.v1.txt  # Deprecated basic template
│   └── affirmations.generator.v2.txt  # Current neuroscience-based template
└── services/
    └── affirmation-generator.ts       # Main implementation
```

## Version Management

### When to Bump Version
Bump the prompt template version when:
- Static prefix content changes (rules, schema, examples)
- JSON schema structure changes
- Examples are updated

### How to Bump Version
1. Update `PROMPT_TEMPLATE_VERSION` constant in `affirmation-generator.ts`
2. Create new template file: `affirmations.generator.v2.txt`
3. Update `PROMPT_CACHE_KEY` to use new version
4. Old cache entries will expire naturally

## Best Practices

1. **Keep Static Prefix Deterministic**:
   - No timestamps
   - No request IDs
   - No randomized examples
   - Stable property ordering in JSON schema

2. **Monitor Cache Performance**:
   - Check logs for cache hit rates
   - Alert if hit rate drops unexpectedly
   - Track cost savings from caching

3. **Handle High Throughput**:
   - If >15 requests/min on same prefix+key, consider sharding
   - Shard keys: `affirmations:generator:v1:a`, `affirmations:generator:v1:b`

4. **Template Management**:
   - Keep templates in versioned files
   - Use consistent naming: `affirmations.generator.v{version}.txt`
   - Document changes in PROGRESS.md

## Cost Savings

Prompt caching provides significant cost savings:
- **Cached tokens**: ~50-80% cheaper than uncached tokens
- **Latency**: 20-40% faster for cached requests
- **Scalability**: Better performance under load

## References

- [OpenAI Prompt Caching Documentation](https://platform.openai.com/docs/guides/prompt-caching)
- Implementation follows OpenAI's recommended best practices
- See `PROGRESS.md` for implementation timeline

