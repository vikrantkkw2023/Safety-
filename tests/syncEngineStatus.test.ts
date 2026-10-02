import test from "node:test";
import assert from "node:assert/strict";
import { enqueueOperation, removeOperation } from "../src/syncQueue";

test("incident status operations are represented as queued work", () => {
  const queue = enqueueOperation([], {
    type: "INCIDENT_STATUS",
    payload: {
      incident_id: "local-sos-1",
      status: "RESOLVED",
      ended_at: "2026-10-02T10:05:00.000Z",
    },
  });

  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.type, "INCIDENT_STATUS");
  assert.equal(removeOperation(queue, 0).length, 0);
});
