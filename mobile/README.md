# Safety mobile app

This directory contains the Expo/React Native implementation of Safety MVP 1.

## Current capabilities

- Home screen with prominent SOS button
- 5-second cancellation countdown
- Foreground GPS capture
- Trusted contact management stored locally on-device
- Emergency incident persistence while the app is running/reopened
- Emergency SMS composer with a Google Maps location
- One-tap calling of trusted contacts
- Active emergency screen
- End emergency flow

## Run locally

Install Node.js and the Expo CLI, then from this directory:

```bash
npm install
npm start
```

For an Android device/emulator:

```bash
npm run android
```

For iOS:

```bash
npm run ios
```

## Important behavior

SMS is handed to the operating system's SMS interface. The app does not silently send SMS messages. This is intentional for transparency and platform safety.

MVP 1 stores contacts and the active incident locally. A later production phase should add authenticated Supabase storage, server-side notifications, audit logging, rate limits, and secure access policies.

## Production hardening still required

- Authenticated backend
- Server-side emergency incident storage
- Push notification service
- Secure live location sharing
- Abuse/rate-limit controls
- Automated tests
- Crash/error monitoring
- Privacy policy and consent flows
- Security review
- Authorized emergency-service integration before claiming official dispatch
