# Plastic CRM (demo)

Demo di un CRM per studi di chirurgia plastica ed estetica, focalizzato sul richiamo dei pazienti dormienti.

- Dati fittizi, salvati solo nel browser (localStorage).
- Nessun backend: i messaggi si aprono su WhatsApp/email tramite link.

## Sviluppo

    npm install
    npm run dev
    npm test

## Ambienti

| | Demo | Produzione |
|---|---|---|
| Backend | `VITE_DATA_BACKEND=local` (localStorage, seed) | `VITE_DATA_BACKEND=supabase` |
| Hosting | GitHub Pages, `npm run deploy` | Cloudflare Pages, build automatica da `main` |

Variabili in `.env.example`. Per sviluppare contro Supabase copia `.env.example` in `.env.local` e compila URL e anon key.

Schema DB in `supabase/migrations`, applicato con `supabase db push`. Checklist di rilascio in `docs/CHECKLIST-PROD.md`.
