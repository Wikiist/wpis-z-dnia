# Wpis z dnia

Asystent dokumentacji dla nauczycieli przedszkola. Kilka zdań o dniu grupy → wpis do dziennika zgodny z **nową podstawą programową wychowania przedszkolnego** (rozporządzenie MEN z 11 marca 2026 r., Dz.U. 2026 poz. 378, załącznik nr 1), z:

- tematem dnia i opisem tego, co dzieci naprawdę robiły (bez gotowców),
- sprawczością dzieci (co wybrały, zaproponowały, zrobiły same),
- kodami osiągnięć z 9 obszarów podstawy i doświadczeń edukacyjnych (D.1–D.7), z oficjalnym brzmieniem,
- wiadomością dla rodziców i pomysłem na jutro.

**Live:** https://wpis-z-dnia.vercel.app

## Jak działa
- `data/annex1-preschool.txt` — tekst załącznika nr 1; `scripts/parse.mjs` robi z niego `data/obszary.json` (113 osiągnięć w 9 obszarach + 7 doświadczeń).
- `api/entry.js` — wysyła notatki i listę kodów do modelu (Gemini) z wymuszonym schematem JSON; zwrócone kody są sprawdzane z listą z rozporządzenia, nieistniejące są odrzucane.
- `public/index.html` — jedna strona, bez frameworka.
- Prywatność: notatki nie są zapisywane; model ma polecenie pomijać imiona dzieci.

## Uruchomienie
    node scripts/parse.mjs   # odtworzenie danych
    node --test              # testy
    vercel deploy            # wymaga GEMINI_API_KEY w ustawieniach projektu

Zbudowane w jeden dzień z Claude Code przez Wiktora Grzyba ([zapytaj moje AI](https://ask-wiktor.vercel.app/?lang=pl)).
