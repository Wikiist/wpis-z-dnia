import { test } from "node:test";
import assert from "node:assert/strict";
import { normalise, makeEntry } from "./api/entry.js";

test("keeps only real curriculum codes, sorted, with official wording", () => {
  const r = normalise({ plan_dnia: [{ sekcja: "Sytuacje edukacyjne", pozycje: [{ tytul: "„Dokąd potoczy się piłka”", opis: "rzuty", codes: ["9.4", "4.11", "9.99", "D.2", "9.1", "4.11"] }] }], doswiadczenia: [{ code: "D.2", why: "y" }, { code: "1.1", why: "wrong list" }] });
  const p = r.plan_dnia[0].pozycje[0];
  assert.deepEqual(p.codes.map((c) => c.code), ["4.11", "9.1", "9.4"]);
  assert.equal(p.tytul, "Dokąd potoczy się piłka");
  assert.deepEqual(r.doswiadczenia.map((c) => c.code), ["D.2"]);
});

test("rejects notes that are too short", async () => {
  const r = await makeEntry({ notes: "spacer" });
  assert.equal(r.status, 400);
});

test("sections follow the order of the day; unknown and empty sections are dropped", () => {
  const r = normalise({
    plan_dnia: [
      { sekcja: "Aktywności w strefach", pozycje: [{ strefa: "Strefa ciszy", tytul: "Chwila ciszy", opis: "oddech", codes: ["2.9", "9.10"] }] },
      { sekcja: "Coś innego", pozycje: [{ tytul: "x", opis: "x", codes: ["1.1"] }] },
      { sekcja: "Zabawy poranne", pozycje: [{ strefa: "zła", tytul: "Karuzela śmiechu", opis: "chusta", codes: ["1.2", "3.21"] }] },
      { sekcja: "Aktywność outdoorowa", pozycje: [] },
    ],
  });
  assert.deepEqual(r.plan_dnia.map((s) => s.sekcja), ["Zabawy poranne", "Aktywności w strefach"]);
  assert.equal(r.plan_dnia[1].pozycje[0].strefa, "Strefa ciszy");
  assert.equal(r.plan_dnia[0].pozycje[0].strefa, "");
});

test("coverage counts the 9 areas the day touched", () => {
  const r = normalise({ plan_dnia: [{ sekcja: "Sytuacje edukacyjne", pozycje: [{ tytul: "a", opis: "a", codes: ["4.5", "4.6", "8.1"] }] }], dalton: { samodzielnosc: "a" } });
  assert.equal(r.pokrycie.length, 9);
  assert.deepEqual(r.pokrycie.find((a) => a.obszar === "Obszar matematyczny").codes, ["4.5", "4.6"]);
  assert.equal(r.pokrycie.filter((a) => a.codes.length).length, 2);
  assert.equal(r.dalton.wspolpraca, "");
});

test("items without a title are kept; the diary line is the description", () => {
  const r = normalise({ plan_dnia: [{ sekcja: "Czynności higieniczne i samoobsługowe", pozycje: [{ tytul: "", opis: "mycie rąk przed śniadaniem", codes: ["9.7"] }, { opis: "" , codes: [] }] }] });
  assert.equal(r.plan_dnia[0].pozycje.length, 1);
  assert.equal(r.plan_dnia[0].pozycje[0].tytul, "");
  assert.equal(r.plan_dnia[0].pozycje[0].opis, "mycie rąk przed śniadaniem");
});
