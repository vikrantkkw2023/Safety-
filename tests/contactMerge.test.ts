import test from "node:test";
import assert from "node:assert/strict";
import { mergeContacts } from "../src/contactMerge";

test("merge keeps local contacts and avoids duplicate phone numbers", () => {
  const result = mergeContacts(
    [{ id: "local", name: "Local", phone: "+10000000001", relationship: "Friend" }],
    [
      { id: "remote-duplicate", name: "Remote duplicate", phone: "+1 000 000 0001", relationship: "Family" },
      { id: "remote-new", name: "Remote new", phone: "+10000000002", relationship: null },
    ],
  );

  assert.equal(result.length, 2);
  assert.equal(result[0]?.id, "local");
  assert.equal(result[1]?.id, "remote-new");
  assert.equal(result[1]?.relationship, "Trusted contact");
});
