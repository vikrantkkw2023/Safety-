import test from "node:test";
import assert from "node:assert/strict";
import { enqueueOperation, removeOperation, parseSyncQueue } from "../src/syncQueue";
import { validateEmail, validatePassword, normalizeEmail } from "../src/authRules";

test("queue retry primitives preserve order when an operation is removed", () => {
  const queue = enqueueOperation([], {
    type: "CONTACT_CREATE",
    payload: { name: "A", phone: "+10000000001", relationship: "Friend", country_code: "" },
  });
  const next = enqueueOperation(queue, {
    type: "CONTACT_CREATE",
    payload: { name: "B", phone: "+10000000002", relationship: "Family", country_code: "" },
  });

  assert.equal(removeOperation(next, 0)[0]?.payload.name, "B");
  assert.equal(removeOperation(next, 1)[0]?.payload.name, "A");
});

test("profile operations are valid queue operations", () => {
  const queue = enqueueOperation([], {
    type: "PROFILE_UPSERT",
    payload: { name: "Test User", country_code: "IN", phone: "+919876543210" },
  });
  const parsed = parseSyncQueue(JSON.stringify(queue));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.type, "PROFILE_UPSERT");
});

test("authentication rules reject invalid credentials", () => {
  assert.equal(validateEmail("bad-email"), "Enter a valid email address.");
  assert.equal(validatePassword("1234567"), "Password must contain at least 8 characters.");
  assert.equal(normalizeEmail(" User@Example.COM "), "user@example.com");
});
