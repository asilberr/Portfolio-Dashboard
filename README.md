# DepotCockpit MVP

Next.js Web-App für eine aggregierte Übersicht mehrerer Wertpapierdepots.

## Enthalten

- Dashboard mit Gesamtwert, Wertentwicklung, Depot-Mix, Tops/Flops
- Report- und KI-Review-Sektion als UI-Grundlage
- Supabase-Client für Browser und Server
- SQL-Schema inklusive Row Level Security
- Demo-Daten, damit die App ohne externe Zugangsdaten sofort läuft

## Lokal starten

```bash
npm install
npm run dev
```

Dann `http://localhost:3000` öffnen.

## Supabase anbinden

1. Neues Supabase-Projekt anlegen.
2. `supabase/schema.sql` im SQL Editor ausführen.
3. `.env.example` als `.env.local` kopieren und URL + anon key eintragen.
4. Im nächsten Schritt Login und CRUD für Depots/Positionen aktivieren.

## Geplante nächste Bausteine

1. Supabase Auth (Magic Link oder E-Mail/Passwort)
2. Positionen anlegen/bearbeiten/löschen
3. Market-Data-Adapter mit ISIN/Symbol-Auflösung
4. täglicher Snapshot-Job + aggregierte Performance
5. wöchentliche KI-Review-Generierung
6. PDF-Report in Supabase Storage
7. Import/Übergang vom bestehenden make.com-Workflow
