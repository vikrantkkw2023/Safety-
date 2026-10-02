# MVP 1 Device Testing Checklist

Test on a physical Android/iOS device before treating the app as an emergency tool.

## Setup
- [ ] Install a development/preview build.
- [ ] Add at least one trusted contact.
- [ ] Confirm the contact phone number.
- [ ] Confirm location services are enabled.
- [ ] Confirm the device can open the SMS application.

## SOS
- [ ] Press SOS.
- [ ] Confirm the 5-second countdown appears.
- [ ] Cancel during countdown and confirm no incident is created.
- [ ] Trigger SOS again.
- [ ] Grant location permission.
- [ ] Confirm a current location is displayed.
- [ ] Confirm the Maps link opens at approximately the current location.
- [ ] Confirm the SMS composer contains the emergency message and location.

## Active emergency
- [ ] Close and reopen the app.
- [ ] Confirm the active emergency state is restored.
- [ ] Call a trusted contact from the active screen.
- [ ] End the emergency.
- [ ] Confirm the active state is cleared.

## Failure cases
- [ ] Deny location permission.
- [ ] Disable location services.
- [ ] Use a device without SMS capability.
- [ ] Use an invalid phone number.
- [ ] Trigger/cancel repeatedly.

## Safety
Never use a production emergency number or involve another person in a test without their knowledge and consent. For real danger, use the device's official emergency service.


## Backend integrity tests (when Supabase is connected)

- Attempt to create two ACTIVE incidents for the same user; the second must be rejected by the database constraint.
- Verify latitude outside -90..90 is rejected.
- Verify longitude outside -180..180 is rejected.
- Verify negative GPS accuracy is rejected.
- Verify one user's contacts/incidents cannot be read or modified using another user's authenticated session.
- Verify no service-role key is present in the mobile bundle or repository.
- Verify a failed notification does not delete or mark the incident resolved.
