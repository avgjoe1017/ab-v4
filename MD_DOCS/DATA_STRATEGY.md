# ACQUISITION-READY DATA STRATEGY
Affirm Beats V4
Version 1.2

## 0) Purpose
Make our data an acquisition-grade asset that is:
- Legally transferable
- Valuable on day one to product, growth, and content teams
- Easy to integrate into a buyer’s stack
- Low-liability by design

Core story:
- We do not hoard transcripts
- We convert user intent and outcomes into structured, versioned signals
- We can prove lift from personalization and iteration

---

## 1) What the buyer is actually buying
Not “data.” A packaged learning system with documented lift.

### Buyer-ready assets
- **Intent Ontology**: taxonomy + mapper + node-level efficacy
- **Personalization Memory System**: structured memory distillation + decay + user controls
- **Efficacy Map**: topic × tone × intensity outcomes with statistical rigor
- **Cold Start Personalization Engine**: predictable first-session personalization without raw text
- **Quality Loop**: reason-code heatmap tied to prompt versions and generation strategies
- **Governance Package**: consent provenance, retention enforcement, auditability, SOC 2 posture

---

## 2) Data products
Each “data product” is a deliverable with a schema, documentation, and outputs.

### 2.1 Data Product: Intent Ontology
What it is:
- A versioned hierarchical taxonomy of affirmation intents
- Sensitivity tier per node
- An intent mapper that maps signals to `topic_id`
- Efficacy metrics attached to nodes

Why it matters:
- This is defensible IP
- It compresses user needs into stable IDs that are safer than transcripts
- It is the backbone that powers personalization, analytics, and iteration

Deliverables:
- `INTENT_ONTOLOGY_V{n}.json` export
- `intent_taxonomy_nodes` schema
- `intent_taxonomy_edges` schema
- `INTENT_MAPPER_SPEC.md`
- `INTENT_MAPPER_VALIDATION_REPORT.md`
  - Top-k accuracy or F1 for parent-level intent
  - Safety precision for sensitivity classification
  - Confusion matrix at parent level
- `ONTOLOGY_CHANGELOG.md` with versioned diffs
- Efficacy attachments
  - completion, replay, felt-true, edit distance, reason-code distribution
  - minimum-n thresholds and confidence intervals

### 2.2 Data Product: Personalization Memory System
What it is:
- A structured per-user memory JSON
- Updated by “memory distillation” deltas
- Recency bias and pruning to prevent stale contradictions
- One-click “Clear my memory” semantics

Why it matters:
- Personalized experience without transcript hoarding
- Cheap context, low risk, easy to delete

Deliverables:
- `USER_MEMORY_SCHEMA.json`
- `MEMORY_DISTILLATION_DELTA_SCHEMA.json`
- `MEMORY_DECAY_AND_PRUNING_RULES.md`
- “Clear memory” and deletion semantics
- Audit log posture for any privileged reads of sensitive stores

### 2.3 Data Product: Efficacy Map
What it is:
- A rigorously reported outcomes matrix by:
  - topic_id × tone_class × intensity_band
  - plus prompt_version and generation_strategy overlays

Why it matters:
- This is the evidence engine behind “documented lift”
- It drives roadmap and content decisions quickly

Deliverables:
- `efficacy_map_daily` table spec
- Dashboard spec with:
  - sample size per cell
  - confidence intervals per metric
  - minimum-n threshold gating
- `EFFICACY_METHODS.md` describing significance and reporting standards

### 2.4 Data Product: Cold Start Personalization Engine
What it is:
- A practical system that picks strong defaults in the first session or first two sessions

Why it matters:
- Cold start is where most wellness products lose users
- This creates immediate lift without requiring deep history

Important clarification for diligence:
- “Cold start model” can mean different things to buyers
- We support multiple delivery modes so they can adopt it immediately

Delivery modes:
- Option A: Rules Engine
  - `cold_start_rules_v{n}.json`
  - `cold_start_rules.md`
  - unit tests
  - reference implementation in TypeScript and Python
- Option B: Trainable Baseline Model
  - feature extraction spec
  - training methodology and provenance
  - model card template
  - baseline evaluation report
  - exportable format if appropriate
- Option C: Trained Weights
  - only if legally transferable and strategically worth it
  - model card with provenance, reproducible training run, and data snapshot hashes

Recommendation:
- Ship Option A first
- Build Option B as the strongest acquisition narrative
- Treat Option C as conditional and buyer-specific

### 2.5 Data Product: Quality Loop and Reason-Code Heatmap
What it is:
- A structured view of failure and success drivers tied to:
  - prompt_version
  - generation_strategy
  - topic_id
  - tone_class
  - intensity_band

Why it matters:
- It makes iteration predictable
- It reduces post-merger integration risk

Deliverables:
- `reason_code_taxonomy.md`
- `reason_heatmap_daily` table spec
- Dashboard spec with minimum-n gating and trend deltas

---

## 3) Consent, provenance, and transferability
This section exists to remove deal friction.

### 3.1 Consent toggles
Toggles are explicit, separate, and versioned:
- Personalize my experience
- Help improve the product
- Share anonymized insights
- Sub-toggle within product improvement: allow de-identified text samples for research

### 3.2 Consent ledger requirements
To be diligence-proof, every consent state must tie to the exact copy shown.

Requirements:
- `consent_copy_id` stored on every toggle change
- `consent_version_id` allowed, but `consent_copy_id` is the source of truth
- Store:
  - toggle states
  - timestamps
  - app_version
  - locale
  - timezone where available

Deliverables:
- `CONSENT_COPY_LIBRARY/` directory containing JSON for every locale and version
- `CONSENT_LEDGER_SCHEMA.md`
- Export format used in diligence

### 3.3 M&A transfer clause
Policy requirement:
- Privacy policy includes transfer language for merger, acquisition, or asset sale
- Data transfers remain subject to existing privacy commitments unless users are notified and offered choices where required

Operational requirement:
- “No selling data” is defined as no third-party monetization
- Acquisition transfer is defined as continuity of service and product improvement under the same controls

---

## 4) Historical data policy
Diligence will ask what happens to data collected before this framework.

Choose one policy and document it:
- Policy A: Re-consent at next login
  - quarantine pre-framework data
  - include only post-consent data in transferable datasets
- Policy B: Exclude pre-framework data from transferable datasets
  - cleanest acquisition story
  - keep only thresholded aggregates if already non-identifying

Recommended default:
- Use Policy A only if pre-framework data is meaningfully valuable and re-consent is feasible
- Otherwise use Policy B for a clean transfer story

Deliverables:
- `PRE_FRAMEWORK_DATA_POLICY.md`
- A migration checklist for enforcement

---

## 5) Data minimization, retention, and sensitive handling
The acquisition posture is “asset, not liability.”

### 5.1 Default stance
- No long-term transcript storage by default
- Debug cache only, encrypted, short TTL
- Research samples only with explicit opt-in, redacted, short TTL, audited reads

### 5.2 Debug cache
Purpose:
- Reproduce issues and investigate bugs without keeping long-term content

Rules:
- Encrypted payload
- Hard TTL: 24 to 72 hours
- Audited reads
- Not used for analytics, mining, or training

### 5.3 Embeddings policy
- Treat embeddings as sensitive
- Store only user-scoped
- Never store embeddings derived from sensitive text in global analytics
- Delete embeddings with “Clear memory” and account deletion

### 5.4 Aggregation thresholds
- Do not surface buckets below minimum counts
- Apply k-anonymity style thresholds for dashboards
- Keep taxonomy coarse enough to avoid quasi-identification

Deliverables:
- `RETENTION_AND_DELETION.md`
- `SENSITIVE_DATA_HANDLING.md`
- TTL enforcement logs and tests

---

## 6) Statistical rigor and experimentation standards
Buyers want evidence, not charts.

### 6.1 Minimum-n gating
- Do not report efficacy cells unless n meets threshold
- Default: n ≥ 50
- Increase thresholds for high-variance segments

### 6.2 Confidence intervals
- Always report n and 95% CI
- Completion and replay: Wilson interval
- Rating means: bootstrap CI or t-based where appropriate

### 6.3 A/B testing standards
- Define primary metric before running
- Power or minimum detectable effect target
- Avoid early stopping without sequential testing methodology
- Report:
  - sample size
  - effect size
  - CI
  - p-value where appropriate
  - duration
  - guardrail metrics

Deliverables:
- `EFFICACY_METHODS.md`
- `AB_TEST_REPORT_TEMPLATE.md`
- `EXPERIMENT_REGISTRY.md`

---

## 7) Security posture and SOC 2
This is diligence-critical for regulated exposure or enterprise buyers.

Target posture:
- SOC 2 Type I as soon as prioritized
- SOC 2 Type II as the operational maturity proof

Minimum diligence deliverables even before certification:
- `SOC2_READINESS_CONTROL_MAP.md`
- RBAC policy and access matrix
- Audit logs for research and debug reads
- Incident response plan
- Vendor list and security posture
- Encryption at rest and in transit description

---

## 8) Metrics buyers will ask for
Retention and engagement:
- D1, D7, D30 retention
- sessions per user per week
- completion and replay rates
- saves and favorites

Quality:
- felt-true score distribution
- too-generic rate
- edit distance distribution
- top reason codes by segment

Performance:
- time to affirmations
- time to first audio
- crash rate
- latency percentiles

Monetization if applicable:
- free to paid conversion
- churn and reactivation
- cohort LTV

---

## 9) Integration readiness
The buyer should be able to adopt this quickly.

### 9.1 Standard exports
- users minimal
- consent ledger
- session metadata
- feedback events
- taxonomy versions
- efficacy map daily
- experiment registry and results

### 9.2 Schema stability guarantees
- Version every schema
- Backwards compatible for two versions
- Additive changes preferred
- Breaking changes require a major bump and migration guide

Deliverables:
- `EVENTS_CATALOG.md`
- `SCHEMA_VERSIONING_POLICY.md`
- Sample exports as CSV and Parquet

---

## 10) Data room structure
Make it easy for diligence teams to find hard answers fast.

01 Overview
- narrative one-pager
- architecture diagram
- Data Diligence FAQ

02 Consent and legal
- privacy policy with M&A clause
- consent copy library
- consent ledger schema

03 Schemas and pipelines
- DB ERD and migrations
- event schemas and examples
- memory distillation schemas
- ontology schemas

04 Evidence and experiments
- KPI snapshots
- A/B test reports
- efficacy map methodology and outputs

05 Security and governance
- RBAC policy
- audit log examples
- incident response plan
- SOC 2 readiness mapping

06 Exports and integration
- sample exports
- integration guide
- dashboard reproducibility instructions

---

## 11) Implementation plan and proof posture
Everything above is promissory until “proof artifacts” exist.

### Phase 1: Foundation
- Consent ledger with consent_copy_id
- Event schema validation and catalog
- Memory distillation deltas with decay and pruning
- Debug cache with encryption and TTL enforcement

### Phase 2: Data products
- Intent Ontology v1 export
- Intent mapper v1 and validation report
- Efficacy map pipeline with minimum-n gating and CI reporting
- Reason-code heatmap pipeline
- Cold start rules engine v1

### Phase 3: Proof and packaging
- A/B tests demonstrating lift
- Weekly KPI cadence
- Data room assembly
- SOC 2 readiness package with control mapping and evidence

Proof artifacts required for diligence:
- `INTENT_ONTOLOGY_V1.json`
- `INTENT_MAPPER_VALIDATION_REPORT.md`
- `EFFICACY_METHODS.md`
- `AB_TEST_REPORT_TEMPLATE.md`
- `SOC2_READINESS_CONTROL_MAP.md`
- `CONSENT_COPY_LIBRARY/`
- TTL enforcement logs and deletion tests

---

## 12) What to avoid
- Long-term transcript storage “just in case”
- Global embeddings retention
- Over-granular taxonomy that becomes quasi-identifying
- Demographic overcollection without clear purpose and opt-in
- Any mismatch between policy language and actual retention behavior
