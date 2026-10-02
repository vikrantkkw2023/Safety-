# Safety- — Personal Safety Emergency App

Safety- is a personal safety platform designed to help a person quickly activate an emergency alert and share their location with trusted contacts.

## MVP 1

MVP 1 focuses on a reliable Emergency SOS workflow:

1. User presses SOS.
2. A 5-second cancellation window starts.
3. The app requests/obtains the user's GPS location.
4. An emergency incident is created.
5. Trusted emergency contacts are notified.
6. The user sees an Active Emergency screen.
7. The user can end the emergency.

### MVP 1 flow

```
USER FEELS IN DANGER
        ↓
SOS TRIGGER
        ↓
5-SECOND CANCEL WINDOW
        ↓
GET GPS LOCATION
        ↓
CREATE SOS INCIDENT
        ↓
NOTIFY TRUSTED CONTACTS
        ↓
SHOW ACTIVE EMERGENCY
```

## MVP 1 screens

- Welcome / Login
- Emergency Contacts
- Home / SOS
- SOS Countdown
- Active Emergency

## MVP 1 data model

### users
- id
- name
- phone
- email
- created_at

### emergency_contacts
- id
- user_id
- name
- phone
- relationship
- created_at

### emergency_incidents
- id
- user_id
- latitude
- longitude
- accuracy
- started_at
- ended_at
- status

Incident status:
- ACTIVE
- CANCELLED
- RESOLVED

## Scope boundary

MVP 1 does not include AI risk detection, police dispatch/integration, audio/video recording, or complex background tracking.

Police/emergency-service integration will require appropriate authorization and technical integration with the relevant authorities.

## Development approach

The project is intended to be built with a no-code/AI-assisted workflow. Initial technology direction:

- FlutterFlow for mobile UI
- Supabase/PostgreSQL for backend and database
- Notification service for emergency alerts
- Google Maps or Mapbox for location/map features
- FastAPI/Python only when custom backend logic is needed
- GitHub for project version control

## MVP 1 acceptance test

**Phone A:** Press SOS → GPS obtained → incident created → Active Emergency displayed.

**Phone B:** Trusted contact receives the emergency alert and can access the emergency location.

This repository currently contains the project definition and implementation documentation. The actual no-code mobile implementation will be added as the build progresses.
