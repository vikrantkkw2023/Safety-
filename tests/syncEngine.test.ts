import test from "node:test";
import assert from "node:assert/strict";
import { removeOperation, enqueueOperation } from "../src/syncQueue";

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
