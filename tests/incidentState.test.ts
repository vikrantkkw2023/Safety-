import test from "node:test";
import assert from "node:assert/strict";
import { shouldRecoverBackendIncident } from "../src/incidentState";

const remote = {
  id: "remote-1",
  latitude: 18.52,
  longitude: 73.85,
  accuracy: 10,
  startedAt: "2026-10-02T10:00:00.000Z",
  status: "ACTIVE" as const,
};

test("recovers a backend active incident when local state is missing", () => {
  assert.equal(shouldRecoverBackendIncident(null, remote), true);
});

test("does not replace an already active local incident", () => {
  assert.equal(
    shouldRecoverBackendIncident({ id: "local", status: "ACTIVE" }, remote),
    false,
  );
});

test("does not recover when backend has no active incident", () => {
  assert.equal(shouldRecoverBackendIncident(null, null), false);
});
