# Trusted Contact Notification Architecture

## Security boundary

The mobile app must never contain a Supabase service-role key or other privileged server credential.

The notification path is:

1. User activates SOS.
2. The mobile app creates/synchronizes the incident.
3. A trusted server/Edge Function receives the authorized event.
4. The server verifies the authenticated user and incident.
5. The server resolves the user's trusted contacts and registered notification devices.
6. The server sends the minimum necessary emergency notification.
7. Delivery failures are recorded without changing the SOS incident to resolved.

## Notification content

The initial notification should contain only the minimum necessary information, such as:
- emergency status
- sender identity/name where appropriate
- current location link when authorized
- incident timestamp

Do not expose database credentials or internal identifiers to recipients.

## Delivery semantics

Push delivery is not guaranteed. The app must continue showing the active emergency even when notification delivery fails.

SMS can remain an explicit native-device fallback during testing; the OS controls the final send action.

## Production prerequisites

- Authorized notification provider configuration
- Secure server/Edge Function secrets
- Device-token registration
- Recipient consent/privacy review
- Real-device testing on iOS and Android
- Rate limiting and abuse protection
- Audit logging without unnecessary location retention
