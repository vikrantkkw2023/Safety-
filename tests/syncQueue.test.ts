import test from "node:test";
import assert from "node:assert/strict";
import { enqueueOperation, removeOperation } from "../src/syncQueue";

test("enqueueOperation adds an operation", () => {
  const result = enqueueOperation([], {
    type: "PROFILE_UPSERT",
    payload: { name: "Test User" },
  });
  assert.equal(result.length, 1);
});

test("queue stays bounded at 50 items", () => {
  let queue: import("../src/syncQueue").SyncOperation[] = [];
  for (let i = 0; i < 55; i += 1) {
    queue = enqueueOperation(queue, {
      type: "PROFILE_UPSERT",
      payload: { name: String(i) },
    });
  }
  assert.equal(queue.length, 50);
  assert.equal(queue[0]?.payload.name, "5");
});

test("removeOperation ignores invalid indexes", () => {
  const queue = [{
    type: "PROFILE_UPSERT",
    payload: { name: "Test User" },
  }] as const;
  assert.equal(removeOperation([...queue], -1).length, 1);
  assert.equal(removeOperation([...queue], 2).length, 1);
});

test("removeOperation removes the requested item", () => {
  const queue: import("../src/syncQueue").SyncOperation[] = [
    { type: "PROFILE_UPSERT", payload: { name: "A" } },
    { type: "PROFILE_UPSERT", payload: { name: "B" } },
  ];
  const result = removeOperation(queue, 0);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.payload.name, "B");
});
