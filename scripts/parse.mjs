// Builds data/obszary.json from the official preschool core curriculum (Dz.U. 2026 poz. 378, Annex 1).
// Usage: node scripts/parse.mjs
import { readFileSync, writeFileSync } from "node:fs";
const raw = readFileSync("data/annex1-preschool.txt", "utf8");
const start = raw.indexOf("Osiągnięcia dziecka na koniec wychowania przedszkolnego");
const end = raw.indexOf("Warunki i sposób realizacji", start);
let s = raw.slice(start, end > 0 ? end : undefined)
  .replace(/﻿?\s*Dziennik Ustaw[\s\S]*?Poz\. 378/g, " ")   // drop page headers
  .replace(/\s+/g, " ");
const clean = (t) => t.trim().replace(/\. [A-ZŁŚŻŹĆ].*$/, "").replace(/[;.:]\s*$/, ""); // drop text that runs into the next paragraph
const areas = [];
const areaRe = /(\d)\. Obszar ([^:]+): ([^.]+?)\. Dziecko:/g;
const heads = [...s.matchAll(areaRe)];
heads.forEach((m, i) => {
  const body = s.slice(m.index + m[0].length, i + 1 < heads.length ? heads[i + 1].index : undefined);
  const items = [];
  const itemRe = /(\d{1,2})\) (.+?)(?=(?: \d{1,2}\) )|$)/g;
  for (const it of body.matchAll(itemRe)) {
    if (Number(it[1]) !== items.length + 1) break; // numbering restarts = next section of the act
    items.push({ code: `${m[1]}.${it[1]}`, text: clean(it[2]) });
  }
  areas.push({ id: Number(m[1]), name: `Obszar ${m[2].trim()}`, subtitle: m[3].trim(), items });
});
// "Doświadczenia edukacyjne": what every child experiences at least once a school year
const expStart = s.indexOf("co najmniej raz w roku szkolnym:");
const experiences = [];
if (expStart > 0) {
  const body = s.slice(expStart + "co najmniej raz w roku szkolnym:".length);
  for (const it of body.matchAll(/(\d{1,2})\) (.+?)(?=(?: \d{1,2}\) )|$)/g)) {
    if (Number(it[1]) !== experiences.length + 1) break;
    experiences.push({ code: `D.${it[1]}`, text: clean(it[2]) });
  }
}
writeFileSync("data/obszary.json", JSON.stringify({ source: "Rozporządzenie Ministra Edukacji z 11 marca 2026 r., Dz.U. 2026 poz. 378, załącznik nr 1", areas, experiences }, null, 1));
console.log("doświadczenia:", experiences.length);
console.log(areas.map((a) => `${a.id} ${a.name}: ${a.items.length}`).join("\n"));
