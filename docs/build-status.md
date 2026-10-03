# Safety Build Status

## Implemented in the mobile client

- [x] Home screen
- [x] SOS button
- [x] 5-second cancellation
- [x] Foreground GPS permission and capture
- [x] Local trusted-contact management
- [x] Local active-incident persistence
- [x] Emergency location link
- [x] SMS handoff to the device messaging interface
- [x] Trusted-contact calling
- [x] Active emergency screen
- [x] End emergency
- [x] Basic accessibility labels
- [x] GPS/SMS failure handling
- [x] Country-required local profile signup
- [x] Full country names in the country selector
- [x] Automatic country calling code
- [x] Country-aware phone validation and E.164 normalization

## Backend foundation and synchronization

- [x] Supabase-compatible schema and RLS policies
- [x] Supabase JS client with persisted mobile sessions
- [x] Typed profile/contact/incident data access
- [x] Persistent sync queue
- [x] Profile, contact and incident queue handling
- [x] Backend active-incident recovery
- [x] Backend contact recovery/merge
- [x] Local profile/contact synchronization when a Supabase session exists
- [x] Idempotent incident synchronization using client_local_id
- [x] Automated CI workflow for typecheck and unit tests
- [x] Notification device registration backend boundary
- [x] Notification registration helper without privileged credentials

## Still required before production

- [ ] Supabase Auth UI (email/password sign-up and sign-in)
- [ ] Email verification and password recovery UX
- [ ] Real Supabase project credentials/configuration
- [ ] Production push notification provider/server function
- [ ] Install and configure the selected push provider SDK
- [ ] Device push-token registration
- [ ] Secure recipient location page
- [ ] Background/live location
- [ ] Crash monitoring
- [ ] Privacy policy and consent UX
- [ ] Security/privacy review
- [ ] Real Android/iOS device testing
- [ ] CI run verification after the latest changes

## Emergency-number testing policy

- [x] No real emergency-service number is embedded in the test app.
- [x] Test-only placeholder is intentionally invalid.
- [ ] Any production emergency-service integration requires authorization and end-to-end approval.

The local MVP must never be represented as guaranteed police, ambulance, or emergency dispatch.

## Important verification rule

Code changes are committed to the repository, but a feature is not considered verified until typecheck/tests and real-device behavior have actually been observed. No passing test result is claimed here unless GitHub Actions or a real device provides that result.
