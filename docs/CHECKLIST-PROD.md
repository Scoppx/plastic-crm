# Checklist produzione

## Setup una tantum

- [ ] Supabase CLI: `supabase login`, poi `supabase link --project-ref tsclykbqwmiytqpvxayn`
- [ ] `supabase db push` (applica le due migrazioni: schema e FK `visits.treatment_id` → `no action`) — **prima** di creare gli utenti, altrimenti il trigger che crea impostazioni e trattamenti di default non scatta
- [ ] Authentication > Sign In / Providers > Email: "Allow new users to sign up" **off**, "Confirm email" **off**
- [ ] Authentication > URL Configuration: Site URL `https://<progetto>.pages.dev`; Redirect URLs `https://<progetto>.pages.dev/**` e `http://localhost:5173/**`
- [ ] Authentication > Email Templates > "Reset Password" in italiano: oggetto "Reimposta la password", corpo con il link `{{ .ConfirmationURL }}`
- [ ] Nota email: l'SMTP integrato di Supabase è limitato (poche email/ora e solo verso i membri del progetto). Per il medico serve un SMTP custom (Project Settings > Authentication > SMTP) oppure aggiungere la sua email come membro del progetto
- [ ] Authentication > Users > Add user: il medico e gli utenti di prova `test-a` / `test-b` (con "Auto Confirm User")
- [ ] GitHub: Settings > Secrets and variables > Actions → `SUPABASE_URL`, `SUPABASE_ANON_KEY`; poi Actions > "Supabase keep-alive" > Run workflow
- [ ] Cloudflare Pages: connetti il repo `Scoppx/plastic-crm`, build command `npm run build`, output `dist`, branch `main`; variabili `VITE_DATA_BACKEND=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NODE_VERSION=20`
- [ ] Allineare `site_url` e `additional_redirect_urls` in `supabase/config.toml` al nome reale del progetto Pages (ora `plastic-crm.pages.dev`)

## Checklist

Da eseguire su https://<progetto>.pages.dev con due utenti (`test-a`, `test-b`).

- [ ] Apertura senza sessione → pagina Accedi
- [ ] Login errato → "Email o password errati"
- [ ] Login test-a → dashboard, 8 trattamenti in Impostazioni, nessun banner demo
- [ ] Crea paziente, visita, contatto → ricarica pagina → tutto presente
- [ ] Secondo browser (o telefono) con test-a → stessi dati
- [ ] Login test-b → nessun paziente di test-a
- [ ] Impostazioni: cambia nome studio → ricarica → resta
- [ ] Impostazioni: elimina trattamento senza visite → sparisce; con visite → pulsante disabilitato
- [ ] Impostazioni: cambia password → logout → login con la nuova
- [ ] Password dimenticata → email ricevuta → link apre /reset-password → nuova password funziona
- [ ] Password dimenticata: il link va aperto nello stesso browser da cui è stata richiesta (PKCE)
- [ ] Esci → torna ad Accedi; ricarica → resta su Accedi
- [ ] Rete off (DevTools) → crea paziente → toast "Salvataggio fallito, riprova" e paziente sparisce
- [ ] Demo su GitHub Pages ancora funzionante con banner e reset
- [ ] Actions > Supabase keep-alive → run verde
