# MVP 1 — Product Requirements

## Objective

Provide a fast, simple emergency SOS mechanism for a user who feels unsafe.

## Functional requirements

### FR-01 — Account
A user can create an account and sign in.

### FR-02 — Trusted contacts
A user can add, view, and remove trusted emergency contacts.

### FR-03 — SOS
The home screen provides a prominent SOS action.

### FR-04 — Cancellation window
After SOS is triggered, show a 5-second countdown with a cancellation option.

### FR-05 — Location
After the countdown, request location permission when required and obtain the user's current GPS coordinates and accuracy.

### FR-06 — Incident
Create an emergency incident containing the user, coordinates, accuracy, start time, and ACTIVE status.

### FR-07 — Notification
Send an emergency notification to configured trusted contacts.

### FR-08 — Active emergency
Show the user that the emergency is active and provide the emergency start time/location status.

### FR-09 — End emergency
Allow the user to end an active emergency and record the end time/status.

## Non-functional requirements

- Minimize the number of actions required to trigger SOS.
- Clearly communicate location-permission and notification status.
- Protect personal and location data.
- Do not claim police response unless an authorized emergency integration is actually available.
- Design for graceful failure when GPS, internet, or notifications are unavailable.

## Out of scope

- AI-based risk scoring
- Automatic crime detection
- Police dispatch
- Audio/video evidence capture
- Complex background tracking
