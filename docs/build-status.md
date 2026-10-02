# MVP 1 Build Status

## Implemented in the mobile client

- [x] Home screen
- [x] SOS button
- [x] 5-second cancellation
- [x] Foreground GPS permission and capture
- [x] Local trusted-contact management
- [x] Local active-incident persistence
- [x] Emergency location link
- [x] SMS handoff to the device's messaging interface
- [x] Trusted-contact calling
- [x] Active emergency screen
- [x] End emergency
- [x] Basic accessibility labels
- [x] Failure messages for GPS/SMS limitations

## Connected backend preparation

- [x] Supabase-compatible schema
- [x] Row-level security policies
- [x] Environment-variable template
- [x] Production build configuration

## Not yet connected

- [ ] Supabase Auth in the mobile client
- [ ] Server-side incident creation
- [ ] Server-side trusted contacts
- [ ] Push notification delivery
- [ ] Secure recipient location page
- [ ] Background/live location
- [ ] Automated tests
- [ ] Crash monitoring
- [ ] Privacy policy / consent UX
- [ ] Security review

The current client remains usable without a backend. Do not represent the local MVP as guaranteed emergency dispatch.


## Emergency-number testing policy
- [x] No real emergency-service number is embedded in the app.
- [x] Test-only placeholder is intentionally invalid: +00 000 000 0000
- [ ] Replace with an authorized production emergency integration only after end-to-end testing and approval.
