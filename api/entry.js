// POST /api/entry { notes, zones, outdoor, group, parents, short } -> diary entry in the ramowy plan dnia format,
// every activity tagged with codes from the 2026 preschool core curriculum. Nothing is stored. Key from env (GEMINI_API_KEY).
import { readFileSync } from "node:fs";
import path from "node:path";

const DATA = JSON.parse(readFileSync(path.join(process.cwd(), "data", "obszary.json"), "utf8"));
const MODEL = process.env.ENTRY_MODEL || "gemini-3.5-flash";
const FALLBACK = process.env.ENTRY_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const CODES = new Map();
for (const a of DATA.areas) for (const it of a.items) CODES.set(it.code, { area: a.name, text: it.text });
for (const e of DATA.experiences) CODES.set(e.code, { area: "Doświadczenie edukacyjne", text: e.text });

// order of the day, as directors and LiveKid diaries expect it
export const SECTIONS = ["Zabawy poranne", "Czynności higieniczne i samoobsługowe", "Sytuacje edukacyjne", "Aktywność outdoorowa", "Aktywności w strefach"];

const CURRICULUM = [
  ...DATA.areas.map((a) => `${a.name} (${a.subtitle}):\n` + a.items.map((i) => `  ${i.code} ${i.text}`).join("\n")),
  "Doświadczenia edukacyjne (co najmniej raz w roku):\n" + DATA.experiences.map((e) => `  ${e.code} ${e.text}`).join("\n"),
].join("\n");

const SYSTEM = `Jesteś asystentem nauczyciela przedszkola. Z krótkich notatek o dniu grupy przygotowujesz wpis do dziennika zgodny z nową podstawą programową wychowania przedszkolnego (Dz.U. 2026 poz. 378), obowiązującą od 1 września 2026.

Układ wpisu (ramowy plan dnia). Używaj tylko tych sekcji, które wynikają z notatek, w tej kolejności:
${SECTIONS.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Każda pozycja to jedna aktywność: krótki tytuł (np. Karuzela śmiechu, Dokąd potoczy się piłka), jedno zdanie opisu tego, co dzieci robiły, i lista kodów z podstawy, które ta aktywność realizuje (zwykle 2–6, maksymalnie 8). Kody muszą wynikać z opisu; lepiej mniej i trafnie.

Aktywności w strefach (plan daltoński):
- Dla każdej strefy (kącika) podaj nazwę strefy, np. Strefa działań przyrodniczych, Strefa działań językowych, Strefa działań technicznych, Strefa działań artystycznych, Strefa czytelnicza, Strefa budowania i konstruowania, Strefa ciszy albo Strefa umiejętności odpoczywania.
- Opisuj propozycję, którą nauczycielka przygotowała w strefie na dzień lub tydzień, a nie to, co robiło każde dziecko. Pisz samą aktywność, zwykle rzeczownikowo, np. „Odkrywanie właściwości magnetycznych przedmiotów z najbliższego otoczenia.”, „Malowanie akwarelami zachodu słońca, mieszanie barw.” Nie zaczynaj od „Nauczycielka przygotowała”.
- Strefa ciszy lub odpoczynku to pełnoprawna strefa: samoregulacja, spokojny oddech, rozpoznawanie emocji, zgłaszanie potrzeby odpoczynku (obszar osobisty i ruchowy, np. 2.9, 2.12, 9.10).
- Pole „strefa” wypełniaj tylko w tej sekcji.

Aktywność outdoorowa: plac zabaw, ogród, spacer, wyjście na dwór to pełnoprawna część dnia (zabawa swobodna, gry ruchowe, obserwacje przyrody, zasady bezpieczeństwa), z własnymi kodami.

Zasady języka:
- Opisuj to, co dzieci naprawdę robiły, a nie ogólne formułki. Żadnych gotowców typu „dzieci rozwijały kompetencje”.
- Pokazuj sprawczość dzieci: co wybrały, zaproponowały, zaplanowały albo zrobiły same.
- Nie używaj imion ani nazwisk dzieci. Zastąp je słowami „dziecko”, „kilkoro dzieci”, „grupa”.
- Naturalna, poprawna polszczyzna doświadczonej nauczycielki. „Dzieci” to rodzaj niemęskoosobowy (dzieci słuchały, bawiły się; nigdy „słuchali”). Bez kalk z angielskiego, bez myślników w zdaniach (użyj przecinka albo dwukropka). Tytuły bez cudzysłowów.

Pozostałe pola:
- doswiadczenia: 0–2 kody D.x tylko jeśli wynikają z notatek, z jednym zdaniem dlaczego.
- dalton: dla samodzielności, odpowiedzialności, współpracy i refleksji jedno zdanie tylko wtedy, gdy wynika z notatek; inaczej pusty tekst.
- dla_rodzicow: ciepła, 3–4 zdania, konkretna, z jednym pytaniem, które rodzic może zadać dziecku w domu, sformułowanym bez rodzaju gramatycznego (np. „Który instrument był dziś najfajniejszy?”, a nie „Jaki instrument wybrałeś?”).
- Zwróć wyłącznie JSON według schematu.

Lista kodów z podstawy programowej:
${CURRICULUM}`;

const SHORT = "TRYB KRÓTKI (dziennik papierowy, mało miejsca): każde pole „opis” to samo hasło, najwyżej 6 słów, bez czasownika w czasie przeszłym i bez kropki, np. „badanie magnetyzmu”, „technika akwareli”, „mycie rąk przed posiłkiem”. Najwyżej 3 kody na pozycję. Temat, sprawczość i wiadomość dla rodziców też krótsze.";

const codesArr = { type: "array", items: { type: "string" } };
const SCHEMA = {
  type: "object",
  properties: {
    temat: { type: "string" },
    plan_dnia: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sekcja: { type: "string", enum: SECTIONS },
          pozycje: { type: "array", items: { type: "object", properties: { strefa: { type: "string" }, tytul: { type: "string" }, opis: { type: "string" }, codes: codesArr }, required: ["tytul", "opis", "codes"] } },
        },
        required: ["sekcja", "pozycje"],
      },
    },
    sprawczosc: { type: "string" },
    doswiadczenia: { type: "array", items: { type: "object", properties: { code: { type: "string" }, why: { type: "string" } }, required: ["code", "why"] } },
    dalton: { type: "object", properties: { samodzielnosc: { type: "string" }, odpowiedzialnosc: { type: "string" }, wspolpraca: { type: "string" }, refleksja: { type: "string" } }, required: ["samodzielnosc", "odpowiedzialnosc", "wspolpraca", "refleksja"] },
    dla_rodzicow: { type: "string" },
    pomysl_na_jutro: { type: "string" },
  },
  required: ["temat", "plan_dnia", "sprawczosc", "doswiadczenia", "dalton", "dla_rodzicow", "pomysl_na_jutro"],
};

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 15;
}

const byCode = (a, b) => a.split(".").map(Number).reduce((r, n, i) => r || n - Number(b.split(".")[i]), 0);

// keep only codes that exist in the act, attach the official wording, sort sections into the order of the day,
// and count which of the 9 areas the day touched
export function normalise(out) {
  const codeList = (arr, max = 8) => [...new Set((Array.isArray(arr) ? arr : []).map((c) => String(c).trim()))]
    .filter((c) => CODES.has(c) && !c.startsWith("D."))
    .sort(byCode)
    .slice(0, max)
    .map((c) => ({ code: c, area: CODES.get(c).area, text: CODES.get(c).text }));
  const plan = (Array.isArray(out.plan_dnia) ? out.plan_dnia : [])
    .filter((s) => s && SECTIONS.includes(s.sekcja))
    .map((s) => ({
      sekcja: s.sekcja,
      pozycje: (Array.isArray(s.pozycje) ? s.pozycje : []).filter((p) => p && p.tytul).slice(0, 8).map((p) => ({
        strefa: s.sekcja === "Aktywności w strefach" ? String(p.strefa || "") : "",
        tytul: String(p.tytul).replace(/^[„"']+|[”"']+$/g, ""),
        opis: String(p.opis || ""),
        codes: codeList(p.codes),
      })),
    }))
    .filter((s) => s.pozycje.length)
    .sort((a, b) => SECTIONS.indexOf(a.sekcja) - SECTIONS.indexOf(b.sekcja));
  const used = new Set(plan.flatMap((s) => s.pozycje.flatMap((p) => p.codes.map((c) => c.code))));
  const pokrycie = DATA.areas.map((a) => ({ obszar: a.name, codes: a.items.map((i) => i.code).filter((c) => used.has(c)) }));
  const doswiadczenia = (Array.isArray(out.doswiadczenia) ? out.doswiadczenia : [])
    .filter((x) => x && String(x.code).startsWith("D.") && CODES.has(String(x.code)))
    .slice(0, 2)
    .map((x) => ({ code: x.code, why: String(x.why || ""), area: CODES.get(x.code).area, text: CODES.get(x.code).text }));
  const d = out.dalton || {};
  const dalton = Object.fromEntries(["samodzielnosc", "odpowiedzialnosc", "wspolpraca", "refleksja"].map((k) => [k, String(d[k] || "")]));
  return { temat: String(out.temat || ""), plan_dnia: plan, pokrycie, sprawczosc: String(out.sprawczosc || ""), doswiadczenia, dalton, dla_rodzicow: String(out.dla_rodzicow || ""), pomysl_na_jutro: String(out.pomysl_na_jutro || "") };
}

export async function makeEntry({ notes, group, parents, zones, outdoor, short }, fetchImpl = fetch) {
  notes = String(notes || "").trim().slice(0, 1500);
  zones = String(zones || "").trim().slice(0, 1500);
  outdoor = String(outdoor || "").trim().slice(0, 600);
  if (notes.length < 15) return { status: 400, body: { error: "Opisz dzień w 2–3 zdaniach." } };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 200, body: normalise({ temat: "[mock] brak klucza GEMINI_API_KEY", plan_dnia: [{ sekcja: "Sytuacje edukacyjne", pozycje: [{ tytul: "mock", opis: "mock", codes: ["5.2"] }] }] }) };
  const user = `Grupa: ${group || "nie podano"}.\n${short ? SHORT + "\n" : ""}${parents ? "" : "Wiadomość dla rodziców zostaw pustą.\n"}Notatki nauczycielki:\n${notes}${zones ? `\n\nAktywności przygotowane w strefach:\n${zones}` : ""}${outdoor ? `\n\nPlac zabaw / na zewnątrz:\n${outdoor}` : ""}`;
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
          generationConfig: { temperature: 0.4, maxOutputTokens: 6000, responseMimeType: "application/json", responseSchema: SCHEMA, thinkingConfig: { thinkingLevel: "medium" } },
        }),
      });
    } catch {
      return { ok: false, status: 504, text: async () => "timeout" };
    } finally {
      clearTimeout(t);
    }
  };
  let res = await call(MODEL, 30000);
  if (!res.ok && [429, 500, 503, 504].includes(res.status)) res = await call(FALLBACK, 20000);
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
