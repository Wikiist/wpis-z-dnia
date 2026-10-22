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

test("zones and outdoor keep only valid codes", () => {
  const r = normalise({ obszary: [], doswiadczenia: [], strefy: [{ strefa: "matematyczna", co: "liczenie", codes: ["4.6", "99.1", "D.1"] }], na_zewnatrz: { opis: "gry", codes: ["9.2", "x"] }, dalton: { samodzielnosc: "a" } });
  assert.deepEqual(r.strefy[0].codes.map((c) => c.code), ["4.6"]);
  assert.deepEqual(r.na_zewnatrz.codes.map((c) => c.code), ["9.2"]);
  assert.equal(r.dalton.wspolpraca, "");
});
