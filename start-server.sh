#!/bin/sh
# Daemonize the LOCKIN.AI server using exec
# Hinweis: Die Datenbank (data/lockin.db) wird NICHT gelöscht – Nutzer & Sessions
# überleben Server-Neustarts. Zum Zurücksetzen: `npm run db:reset` (oder Datei löschen).
cd /Users/mcdinh/Documents/Documents/lockin-ai
export PATH="/Users/mcdinh/Documents/Documents/lockin-ai/.tools/node-v22.23.2-darwin-arm64/bin:$PATH"
exec node server/index.js
