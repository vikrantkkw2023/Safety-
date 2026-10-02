import test from "node:test";
import assert from "node:assert/strict";
import {
  isDuplicatePhone,
  isValidActiveIncident,
  isValidPhone,
  normalizePhone,
  validateCountryPhone,
} from "../src/safetyRules";

test("normalizes phone numbers", () => {
  assert.equal(normalizePhone("+91 987-654-3210"), "919876543210");
});

test("accepts 7 to 15 digit phone numbers", () => {
  assert.equal(isValidPhone("1234567"), true);
  assert.equal(isValidPhone("123456"), false);
  assert.equal(isValidPhone("123456789012345"), true);
  assert.equal(isValidPhone("1234567890123456"), false);
});

test("detects duplicate phone numbers", () => {
  assert.equal(isDuplicatePhone(["+91 9876543210"], "919876543210"), true);
  assert.equal(isDuplicatePhone(["+91 9876543210"], "919876543211"), false);
});

test("validates only active incidents with finite coordinates", () => {
  assert.equal(isValidActiveIncident({
    id: "SOS-1", latitude: 18.52, longitude: 73.85,
    startedAt: "2026-10-02T00:00:00.000Z", status: "ACTIVE"
  }), true);
  assert.equal(isValidActiveIncident({
    id: "SOS-2", latitude: NaN, longitude: 73.85,
    startedAt: "2026-10-02T00:00:00.000Z", status: "ACTIVE"
  }), false);
  assert.equal(isValidActiveIncident({
    id: "SOS-3", latitude: 18.52, longitude: 73.85,
    startedAt: "2026-10-02T00:00:00.000Z", status: "RESOLVED"
  }), false);
});


test("validates phone length and format for the selected country", () => {
  assert.equal(validateCountryPhone("9876543210", "IN").valid, true);
  assert.equal(validateCountryPhone("12345", "IN").valid, false);
  assert.equal(validateCountryPhone("2025550125", "US").valid, true);
  assert.equal(validateCountryPhone("12345", "US").valid, false);
  assert.equal(validateCountryPhone("9876543210", "").valid, false);
});
