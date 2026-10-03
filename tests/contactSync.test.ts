import test from "node:test";
import assert from "node:assert/strict";
import { syncContactWithFallback } from "../src/contactSync";

test("contact sync falls back to local queue when no authenticated session exists", async () => {
  const contact = {
    id: "local-1",
    name: "Test Contact",
    phone: "+10000000001",
    relationship: "Friend",
  };

  const result = await syncContactWithFallback(contact, []);

  assert.equal(result.synced, false);
  assert.equal(result.queue.length, 1);
  assert.equal(result.queue[0]?.type, "CONTACT_CREATE");
});
