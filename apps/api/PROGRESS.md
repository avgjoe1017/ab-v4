
## Content Moderation System - 2025-12-23 23:09:09

Implemented comprehensive content moderation system for affirmations:

### Database Changes
- Added moderation fields to SessionAffirmation table: moderationStatus, moderationReason, moderatedBy, moderatedAt, originalText, autoFlagged
- Added indexes for efficient moderation queries

### Automated Moderation
- Integrated OpenAI Moderation API for automatic flagging of harmful content (hate, violence, sexual, self-harm)
- Added heuristic checks for negative content patterns
- Affirmations are automatically checked during generation and flagged if problematic

### Admin UI
- Created /admin/moderation page with moderation dashboard
- Shows stats: pending, approved, flagged, rejected, total
- Lists all sessions with flagged/pending affirmations
- Bulk moderation actions (approve/reject multiple)
- Individual actions: approve, reject, flag, edit
- Moderation status badges in session detail view

### API Endpoints
- GET /admin/moderation/stats - Get moderation statistics
- GET /admin/moderation/flagged - Get sessions with flagged affirmations
- POST /admin/moderation/affirmations/:id - Moderate single affirmation
- POST /admin/moderation/affirmations/bulk - Bulk moderate affirmations

### Safety Features
- All moderation actions are audited
- Original text preserved when editing affirmations
- Auto-flagged content clearly marked
- Moderation status visible in session detail pages
- Filter sessions by moderation status

