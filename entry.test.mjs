import { test } from "node:test";
import assert from "node:assert/strict";
import { normalise, makeEntry } from "./api/entry.js";

test("keeps only real curriculum codes and attaches official wording", () => {
  const r = normalise({ obszary: [{ code: "4.5", why: "x" }, { code: "9.99", why: "fake" }, { code: "D.2", why: "wrong list" }], doswiadczenia: [{ code: "D.2", why: "y" }, { code: "1.1", why: "wrong list" }] });
  assert.deepEqual(r.obszary.map((c) => c.code), ["4.5"]);
  assert.match(r.obszary[0].text, /klasyfikuje obiekty/);
  assert.deepEqual(r.doswiadczenia.map((c) => c.code), ["D.2"]);
});

test("rejects notes that are too short", async () => {
  const r = await makeEntry({ notes: "spacer" });
  assert.equal(r.status, 400);
});
