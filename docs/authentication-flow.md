# Authentication Flow

## Production flow

1. User opens Safety.
2. If a valid local test profile exists, the testing flow remains available.
3. In connected production mode, the app restores the Supabase session.
4. If there is no session, show Sign up / Sign in.
5. Signup uses email + password for authentication and separately collects:
   - Full name
   - Country
   - Country-aware phone number
6. The app normalizes the email and stores the phone in E.164 format.
7. After authentication, the profile is synchronized to `profiles`.
8. Email verification requirements are controlled by the Supabase project configuration.
9. Sign out clears the authenticated session.

## Failure handling

- Supabase unavailable: do not crash the app.
- Authentication failure: show a user-readable error and keep the user on the auth screen.
- Profile sync failure: retain the local profile and retry later; do not silently claim backend synchronization succeeded.
- Never log passwords, access tokens, or service-role credentials.

## Testing

- Use test accounts only.
- Do not use real emergency-service numbers.
- Do not send SOS messages to uninformed people during testing.
