# MVP 1 — Product Requirements

## Objective

Provide a fast, simple emergency SOS mechanism for a user who feels unsafe.

## Functional requirements

### FR-01 — Account
A user can create an account and sign in.

### FR-02 — Trusted contacts
A user can add, view, remove, and securely link trusted emergency contacts to Safety accounts. Contact phone numbers are normalized internationally.

### FR-03 — SOS
The home screen provides a prominent SOS action.

### FR-04 — Cancellation window
After SOS is triggered, show a 5-second countdown with a cancellation option.

### FR-05 — Location
After the countdown, request location permission when required and obtain the user's current GPS coordinates and accuracy.

### FR-06 — Incident
Create an emergency incident containing the user, coordinates, accuracy, start time, and ACTIVE status.

### FR-07 — Notification
Send an emergency push notification to linked trusted contacts through a server-side Edge Function. SMS handoff remains OS-controlled.

### FR-08 — Active emergency
Show the user that the emergency is active and provide the emergency start time/location status.

### FR-09 — End emergency
Allow the user to end an active emergency, stop live tracking/audio capture, and record the end time/status.

### FR-10 — Live location
During an active connected SOS, request background location permission and publish the latest location against the server incident UUID.

### FR-11 — Recipient emergency view
An authorized linked trusted contact can open an active incident, view the latest location, and refresh it while access is valid.

### FR-12 — Evidence
During an active SOS, optional microphone capture can create private audio evidence associated with the server incident. Upload failure must not cancel the SOS.

### FR-13 — Offline recovery
Local SOS state remains available when the backend, GPS, notifications, or SMS handoff is unavailable. Retryable backend operations are persisted locally.

### FR-14 — Account security
Users can create/sign in to a Supabase account, recover a password, and safely sign out when no emergency is active.

## Non-functional requirements

- Minimize the number of actions required to trigger SOS.
- Clearly communicate location-permission and notification status.
- Protect personal and location data.
- Do not claim police response unless an authorized emergency integration is actually available.
- Design for graceful failure when GPS, internet, or notifications are unavailable.

## Not yet implemented / separately authorized

- AI-based risk scoring
- Automatic crime detection
- Police dispatch
- Official emergency-service integration
- Responder/control-room workflows
- Video evidence capture
- Operational analytics and responder dashboards
