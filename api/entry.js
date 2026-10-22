// POST /api/entry { notes, group, parents } -> diary entry mapped to the 2026 preschool core curriculum.
// Nothing is stored. Key from env (GEMINI_API_KEY).
import { readFileSync } from "node:fs";
import path from "node:path";

const DATA = JSON.parse(readFileSync(path.join(process.cwd(), "data", "obszary.json"), "utf8"));
const MODEL = process.env.ENTRY_MODEL || "gemini-3.5-flash";
const FALLBACK = process.env.ENTRY_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const CODES = new Map();
for (const a of DATA.areas) for (const it of a.items) CODES.set(it.code, { area: a.name, text: it.text });
for (const e of DATA.experiences) CODES.set(e.code, { area: "Doświadczenie edukacyjne", text: e.text });

const CURRICULUM = [
  ...DATA.areas.map((a) => `${a.name} (${a.subtitle}):\n` + a.items.map((i) => `  ${i.code} ${i.text}`).join("\n")),
  "Doświadczenia edukacyjne (co najmniej raz w roku):\n" + DATA.experiences.map((e) => `  ${e.code} ${e.text}`).join("\n"),
].join("\n");

const SYSTEM = `Jesteś asystentem nauczyciela przedszkola. Z krótkich notatek o dniu grupy przygotowujesz wpis do dziennika zgodny z nową podstawą programową wychowania przedszkolnego (Dz.U. 2026 poz. 378), obowiązującą od 1 września 2026.

Zasady:
- Opisuj to, co dzieci naprawdę robiły, a nie ogólne formułki. Żadnych gotowców typu "dzieci rozwijały kompetencje". Jeśli notatki są skąpe, wpis jest krótki.
- Pokazuj doświadczenia dzieci i ich sprawczość: co wybrały, zaproponowały, zaplanowały albo zrobiły same.
- Przypisuj tylko kody z listy poniżej i tylko te, które wynikają z notatek (2–5 kodów obszarów, 0–2 kody doświadczeń D.x). Do każdego kodu jedno krótkie zdanie, dlaczego.
- Nie używaj imion ani nazwisk dzieci. Jeśli pojawią się w notatkach, zastąp je słowami "dziecko", "kilkoro dzieci", "grupa".
- Pisz naturalną, poprawną polszczyzną, jak doświadczona nauczycielka. Sprawdź odmianę i składnię. Pamiętaj: „dzieci” to rodzaj niemęskoosobowy (dzieci słuchały, bawiły się, zaproponowały; nigdy „słuchali”). Grupa robiła coś, przedszkolaki robiły coś. Bez kalk z angielskiego, bez myślników (także w temacie: użyj przecinka albo dwukropka).
- Praca w strefach (plan daltoński): jeśli nauczycielka opisała pracę w strefach (np. matematycznej, językowej, przyrodniczej, konstrukcyjnej, artystycznej, ruchowej, czytelniczej), dla każdej strefy podaj, co dzieci w niej robiły i jakie kody to realizuje (1–2 kody na strefę). Podkreśl, że dzieci same wybierały strefę i zadania z tablicy planu, pracowały w parach lub samodzielnie, pomagały sobie. Jeśli brak opisu stref, zwróć pustą listę.
- Plac zabaw i aktywność na zewnątrz: jeśli są w notatkach, opisz je jako pełnoprawną część dnia (zabawa swobodna, gry ruchowe, obserwacje przyrody, zasady bezpieczeństwa, uzgadnianie reguł), z 1–3 kodami. Jeśli brak, zostaw puste.
- Wartości planu daltońskiego (samodzielność, odpowiedzialność, współpraca, refleksja): dla każdej napisz jedno zdanie tylko wtedy, gdy wynika z notatek; w przeciwnym razie pusty tekst.
- Wiadomość dla rodziców: ciepła, 3–4 zdania, konkretna, z jednym pytaniem, które rodzic może zadać dziecku w domu.
- Zwróć wyłącznie JSON według schematu.

Lista kodów z podstawy programowej:
${CURRICULUM}`;

const SCHEMA = {
  type: "object",
  properties: {
    temat: { type: "string" },
    wpis: { type: "string" },
    sprawczosc: { type: "string" },
    obszary: { type: "array", items: { type: "object", properties: { code: { type: "string" }, why: { type: "string" } }, required: ["code", "why"] } },
    doswiadczenia: { type: "array", items: { type: "object", properties: { code: { type: "string" }, why: { type: "string" } }, required: ["code", "why"] } },
    strefy: { type: "array", items: { type: "object", properties: { strefa: { type: "string" }, co: { type: "string" }, codes: { type: "array", items: { type: "string" } } }, required: ["strefa", "co", "codes"] } },
    na_zewnatrz: { type: "object", properties: { opis: { type: "string" }, codes: { type: "array", items: { type: "string" } } }, required: ["opis", "codes"] },
    dalton: { type: "object", properties: { samodzielnosc: { type: "string" }, odpowiedzialnosc: { type: "string" }, wspolpraca: { type: "string" }, refleksja: { type: "string" } }, required: ["samodzielnosc", "odpowiedzialnosc", "wspolpraca", "refleksja"] },
    dla_rodzicow: { type: "string" },
    pomysl_na_jutro: { type: "string" },
  },
  required: ["temat", "wpis", "sprawczosc", "obszary", "doswiadczenia", "strefy", "na_zewnatrz", "dalton", "dla_rodzicow", "pomysl_na_jutro"],
};

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 15;
}

// keep only codes that exist in the act, and attach the official wording
export function normalise(out) {
  const keep = (list, prefix) =>
    (Array.isArray(list) ? list : [])
      .filter((x) => x && CODES.has(String(x.code)) && (prefix ? String(x.code).startsWith(prefix) : !String(x.code).startsWith("D.")))
      .slice(0, 5)
      .map((x) => ({ code: x.code, why: String(x.why || ""), area: CODES.get(x.code).area, text: CODES.get(x.code).text }));
  const codeList = (arr) => (Array.isArray(arr) ? arr : []).map(String).filter((c) => CODES.has(c) && !c.startsWith("D.")).slice(0, 3).map((c) => ({ code: c, area: CODES.get(c).area, text: CODES.get(c).text }));
  const strefy = (Array.isArray(out.strefy) ? out.strefy : []).filter((z) => z && z.strefa && z.co).slice(0, 8).map((z) => ({ strefa: String(z.strefa), co: String(z.co), codes: codeList(z.codes) }));
  const zew = out.na_zewnatrz && out.na_zewnatrz.opis ? { opis: String(out.na_zewnatrz.opis), codes: codeList(out.na_zewnatrz.codes) } : null;
  const d = out.dalton || {};
  const dalton = Object.fromEntries(["samodzielnosc", "odpowiedzialnosc", "wspolpraca", "refleksja"].map((k) => [k, String(d[k] || "")]));
  return { ...out, obszary: keep(out.obszary), doswiadczenia: keep(out.doswiadczenia, "D.").slice(0, 2), strefy, na_zewnatrz: zew, dalton };
}

export async function makeEntry({ notes, group, parents, zones, outdoor }, fetchImpl = fetch) {
  notes = String(notes || "").trim().slice(0, 1500);
  zones = String(zones || "").trim().slice(0, 1200);
  outdoor = String(outdoor || "").trim().slice(0, 600);
  if (notes.length < 15) return { status: 400, body: { error: "Opisz dzień w 2–3 zdaniach." } };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 200, body: normalise({ temat: "[mock]", wpis: "[mock] brak klucza GEMINI_API_KEY", sprawczosc: "", obszary: [{ code: "5.2", why: "mock" }], doswiadczenia: [], dla_rodzicow: "", pomysl_na_jutro: "" }) };
  const user = `Grupa: ${group || "nie podano"}.\n${parents ? "" : "Wiadomość dla rodziców zostaw pustą.\n"}Notatki nauczycielki:\n${notes}${zones ? `\n\nPraca w strefach (plan daltoński):\n${zones}` : ""}${outdoor ? `\n\nPlac zabaw / na zewnątrz:\n${outdoor}` : ""}`;
  const call = async (model, ms) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      return await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        signal: ctl.signal,
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 4096, responseMimeType: "application/json", responseSchema: SCHEMA },
        }),
      });
    } catch {
      return { ok: false, status: 504, text: async () => "timeout" };
    } finally {
      clearTimeout(t);
    }
  };
  let res = await call(MODEL, 16000);
  if (!res.ok && [429, 500, 503, 504].includes(res.status)) res = await call(FALLBACK, 12000);
  if (!res.ok) {
    console.error("gemini", res.status, await res.text());
    return { status: 502, body: { error: "Model AI jest teraz przeciążony. Spróbuj za chwilę." } };
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
  try {
    return { status: 200, body: normalise(JSON.parse(text)) };
  } catch {
    return { status: 502, body: { error: "Nie udało się przygotować wpisu. Spróbuj jeszcze raz." } };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "local";
  if (limited(ip)) return res.status(429).json({ error: "Za dużo prób naraz. Odczekaj chwilę." });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const out = await makeEntry(body);
  res.status(out.status).json(out.body);
}
