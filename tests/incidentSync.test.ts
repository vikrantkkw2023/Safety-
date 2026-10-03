import test from "node:test";
import assert from "node:assert/strict";
import { syncIncidentCreate } from "../src/incidentSync";

test("incident creation queues safely when authentication is unavailable", async () => {
  const result = await syncIncidentCreate({
    id: "SOS-test-1",
    latitude: 18.5204,
    longitude: 73.8567,
    accuracy: 10,
    startedAt: "2026-10-02T10:00:00.000Z",
    status: "ACTIVE",
  }, []);

  assert.equal(result.synced, false);
  assert.equal(result.queue.length, 1);
  assert.equal(result.queue[0]?.type, "INCIDENT_CREATE");
  assert.equal(result.queue[0]?.payload.status, "ACTIVE");
});
