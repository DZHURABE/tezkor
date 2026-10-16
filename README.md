# Тезкор (Tezkor) — food delivery for Shahrituz

> **Ишга тушириш йўриқномаси (ўзбекча):** [ИШГА-ТУШИРИШ.md](ИШГА-ТУШИРИШ.md) · Android APK: `android/` + `.github/workflows/apk.yml`

A food delivery platform for Tajikistan with four apps on one order system:
**Customer** · **Restaurant panel** · **Courier app** · **Super admin**.
Currency TJS (сомонӣ), languages Тоҷикӣ / Русский / English, mobile + desktop.
Food delivery for **Shahrituz**, delivery only within **5 km** of the centre (admin can change the radius).

## Run it

```bash
npm start  # production: set ADMIN_PHONE and ADMIN_PASSWORD first (or DEMO=1 for example data); server install: deploy/install.sh
#           # builds apps/web → dist/index.html and starts the API on http://localhost:8080
npm test             # 59 API tests (roles, full order lifecycle, payments, refunds, menu CRUD, admin)
npm run test:ui      # Playwright: every screen × every role × 3 languages + a full order end-to-end
```

No dependencies besides Node 18+. `apps/web/dist/index.html` also works on its own (opened as a file):
it then runs the same API inside the browser and keeps data in localStorage — that is the online demo.

Demo accounts (password `1234`): customer `90 000 03 01`, restaurant `90 000 01 01`,
courier `90 000 02 01`, admin `90 000 00 01`. Test card `4242 4242 4242 4242` (any date/CVC); a card ending in `0002` is declined.

## Addresses and the map

- The customer places a pin on their home: drag/tap the map, press **My location** (GPS), or paste a location from Telegram / Google Maps / Yandex / plain coordinates.
- The server rejects any address farther than `zoneKm` (default 5) from the city centre — error `OUT_OF_ZONE`.
- The courier gets the exact pin as **Google Maps** and **Yandex Maps** navigation links plus copyable coordinates.
- Map: `apps/web/src/ui/map.js`, a small built-in slippy map. With `MAP_TILES` set (the API server sets it) it shows real streets; the offline demo shows a schematic grid.

## Structure

```
apps/web/src/core/rules.js    business rules shared by frontend and backend (state machine, fees, promo, money split)
apps/web/src/core/seed.js     demo data: 5 cities, 10 restaurants, ~90 dishes, 160 historical orders
apps/web/src/core/server.js   the API (70 endpoints, role access control) — runs in browser OR behind HTTP
apps/web/src/core/client.js   API client: transport "local" (prototype) or "http" (SOMON_CONFIG.api)
apps/web/src/ui/map.js        interactive map (pin picker, zone circle, routes), location parsing, navigator links
apps/web/src/ui/*             customer, auth, restaurant, courier, admin screens; kit, shell, i18n (tg/ru/en)
apps/web/src/styles.css       design system (tokens, dark mode, motion, responsive)
apps/api/src/index.js         Node HTTP server: /api/*, rate limit on auth, CORS, serves the web app
apps/api/src/providers/       payment providers (mock, Korti Milli, Visa/MC, wallets) and maps providers
db/schema.sql                 PostgreSQL schema for production
docs/API.md                   endpoint reference + order state machine
```

## Roadmap

1. **Done — working prototype.** All four apps, real order flow and statuses, notifications, menu CRUD, admin with live data, payments (mock), schematic map.
2. **Production backend.** Move storage from JSON file to PostgreSQL (`db/schema.sql`) behind a repository layer; bcrypt/argon2 passwords; SMS OTP login; WebSocket/SSE instead of polling; image upload (S3-compatible).
3. **Integrations.** Real card acquiring (Korti Milli + Visa/Mastercard through a Tajik bank), mobile wallets; real map tiles + routing (OSM/2GIS); live courier GPS from the courier app.
4. **Mobile apps.** Wrap customer and courier apps (PWA → Capacitor/React Native) for Play Store / App Store, push notifications.
5. **Growth.** Courier auto-dispatch, surge pricing, restaurant payouts & invoices, loyalty, analytics export.
