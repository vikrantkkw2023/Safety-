# MVP 1 — Emergency Flow

## Primary flow

```
Home
  ↓
Press SOS
  ↓
5-second countdown
  ├── Cancel → Home
  ↓
Request/Get GPS
  ↓
Create ACTIVE incident
  ↓
Notify trusted contacts
  ↓
Active Emergency screen
  ↓
End Emergency
  ↓
Update incident to RESOLVED
```

## Failure handling

### GPS unavailable
Show a clear status to the user. Do not fabricate a location.

### Internet unavailable
The application must not falsely claim that a server-side incident or notification was created. The eventual implementation should define an offline fallback.

### Notification failure
Show notification status where practical and retain the emergency incident state.

### User cancels
No emergency notification should be sent if cancellation occurs before incident creation.

## Safety principle

The app is an assistance and communication tool. It must not represent itself as a guaranteed emergency-response service unless the relevant emergency authority integration is actually available.
