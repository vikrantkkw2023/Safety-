# MVP 1 — Architecture

## Initial architecture

```
Mobile App (FlutterFlow)
        |
        | Authentication / API
        v
Supabase
  ├── Auth
  ├── PostgreSQL
  └── Emergency incident data
        |
        v
Notification Service
        |
        v
Trusted Contact
```

## Core entities

- User
- Emergency Contact
- Emergency Incident

## Security principles

- Users must only access their own account and incident data.
- Emergency contacts should receive only the information necessary for the emergency workflow.
- Location data is sensitive and must be protected with appropriate database access policies.
- Secrets/API keys must never be committed to GitHub.
- Production deployment should use HTTPS/TLS and secure authentication.
