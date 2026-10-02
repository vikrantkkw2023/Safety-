# Safety — Production Roadmap

## Phase 1 — Working local MVP
- [x] SOS home screen
- [x] 5-second cancellation
- [x] GPS capture
- [x] Trusted contacts
- [x] Emergency SMS composer
- [x] Active emergency state
- [x] End emergency
- [x] Local persistence

## Phase 2 — Connected MVP
- [ ] Supabase Auth
- [ ] PostgreSQL emergency incidents
- [ ] Row Level Security
- [ ] Trusted contact server records
- [ ] Push notifications
- [ ] Secure emergency-location link
- [ ] Incident acknowledgement

## Phase 3 — Safety hardening
- [ ] Rate limiting and abuse prevention
- [ ] Device/network failure handling
- [ ] Location freshness indicators
- [ ] Audit events
- [ ] Privacy/consent screens
- [ ] Data retention and deletion controls
- [ ] Automated unit/integration tests
- [ ] Crash monitoring

## Phase 4 — Advanced safety
- [ ] Optional live location during an active SOS
- [ ] Optional audio/video evidence capture with explicit user control
- [ ] Secure evidence storage
- [ ] Emergency timeline
- [ ] Accessibility improvements
- [ ] Low-connectivity fallback design

## Phase 5 — AI and analytics
AI must assist rather than independently decide whether a user is telling the truth or whether a crime has occurred.

Possible uses:
- anomaly detection
- geospatial analytics
- emergency hotspot analysis
- operational dashboards
- false-alert pattern analysis
- prioritization support for authorized responders

## Phase 6 — Official emergency integration
Only after written authorization, technical integration, testing, and applicable legal/privacy review:

- emergency control-room integration
- police/emergency-service APIs
- verified responder workflows
- responder acknowledgement
- dispatch status

The product must never claim guaranteed official response before such an integration is real and operational.


## Current development step — Backend safety foundation

Before connecting the mobile app to production services, the database now includes:
- one ACTIVE incident per user at the database layer;
- latitude/longitude range validation;
- non-negative GPS accuracy validation;
- country code storage for profiles and trusted contacts;
- unique normalized profile phone numbers.

Next implementation sequence:
1. Supabase project/Auth connection.
2. Secure profile and trusted-contact persistence.
3. Server-side SOS incident creation.
4. Notification delivery through a trusted server/Edge Function.
5. Secure recipient location access.
6. Real-device failure and recovery testing.
