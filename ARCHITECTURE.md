# Zielarchitektur

## MVP

Browser -> Next.js 16 (Vercel) -> Supabase Auth/Postgres/Storage
                              -> Market Data Adapter
                              -> AI Review Adapter

## Datenfluss

1. Nutzer meldet sich via Supabase Auth an.
2. Nutzer legt Depots und Positionen an.
3. Ein geplanter Job aktualisiert Kurse und schreibt `price_snapshots`.
4. Aus den Kursen werden nutzerbezogene `portfolio_snapshots` erzeugt.
5. Das Dashboard liest ausschließlich die Daten des angemeldeten Nutzers (RLS).
6. Ein Wochenjob erzeugt Kennzahlen + KI-Review und persistiert einen Report.
7. PDF/HTML liegt in einem privaten Storage-Bucket; das Dashboard erzeugt kurzlebige Signed URLs.

## Bewusste Entscheidungen

- Market Data und AI als Adapter kapseln, damit Anbieter austauschbar bleiben.
- Performance nicht aus aktuellem Depotwert allein ableiten. Für belastbare Renditekennzahlen später Transaktionen/Cashflows ergänzen und TWR/XIRR berechnen.
- Instrument-Master (`instruments`) wird geteilt, Depot-/Nutzerdaten bleiben strikt nutzerbezogen.
- Service-Role-Key ausschließlich serverseitig/Jobs, niemals im Browser.

## Nächste Migration

Als nächstes ergänzen wir `transactions`, Auth-Seiten und echte CRUD-Flows. Danach binden wir den bestehenden make.com-Report als Übergang ein, bevor wir ihn durch den internen Wochenjob ersetzen.
