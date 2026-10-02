import test from "node:test";
import assert from "node:assert/strict";
import { validateEmail, validatePassword } from "../src/authRules";

test("validates a normal email", () => {
  assert.equal(validateEmail("user@example.test"), null);
});

test("rejects malformed email", () => {
  assert.notEqual(validateEmail("not-an-email"), null);
});

test("rejects empty email", () => {
  assert.notEqual(validateEmail(""), null);
});

test("accepts an 8-character password", () => {
  assert.equal(validatePassword("12345678"), null);
});

test("rejects a short password", () => {
  assert.notEqual(validatePassword("1234567"), null);
});
