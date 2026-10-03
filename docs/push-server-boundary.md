# Push notification server boundary

The mobile app registers Expo push tokens only. It never sends notifications directly with a privileged credential.

Production flow:

1. Mobile app activates an SOS incident.
2. Authorized backend verifies the authenticated user and active incident.
3. Backend resolves the user's trusted contacts and their registered notification devices.
4. A server-side notification worker calls the selected push provider using a server-only credential.
5. Provider delivery is recorded as an attempt.
6. A delivery failure never cancels or resolves the SOS incident.

Required server-side protections:

- service credentials stored only as server secrets
- authenticated user/incident authorization
- recipient relationship/consent checks
- rate limiting and duplicate-notification protection
- minimum necessary notification content
- audit logging without storing unnecessary sensitive location data
- provider response/error handling
- token invalidation for permanently invalid device tokens

The current mobile repository does not claim production push delivery until the server-side provider is configured and tested on physical devices.
