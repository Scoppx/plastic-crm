# Checklist produzione

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
- [ ] Esci → torna ad Accedi; ricarica → resta su Accedi
- [ ] Rete off (DevTools) → crea paziente → toast "Salvataggio fallito" e paziente sparisce
- [ ] Demo su GitHub Pages ancora funzionante con banner e reset
- [ ] Actions > Supabase keep-alive → run verde
- [ ] Password dimenticata: il link va aperto nello stesso browser da cui è stata richiesta (PKCE)
