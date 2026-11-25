# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev             # Express + Vite middleware on one port (http://localhost:3000), --watch restarts the server
npm run build           # vite build -> dist/
npm start               # production: Express serves dist/ and /api (run build first)
npm run lint            # oxlint
npm test                # vitest run (all 106 tests)
npm run test:coverage   # enforces thresholds in vite.config.js (90% lines/statements, 85% functions, 80% branches)
npx vitest run tests/pages.test.jsx -t "sorts by low"   # single file / single test
```

Both `dev` and `start` need `DATABASE_URL` (Neon Postgres connection string) in `.env` (gitignored; see `.env.example`). `server/db.js` calls `process.exit(1)` at import time if it's missing. Tests do **not** need it.

## Architecture

One Node process serves everything, deliberately, so it deploys as a single Render web service (`render.yaml`):

- `server/index.js` mounts `/api` (Express router from `server/api.js`), then either Vite as middleware (`--dev` flag, set by `npm run dev`) or `dist/` static files with an SPA fallback to `index.html`. Dev vs prod is chosen by the `--dev` argv flag, not `NODE_ENV`.
- On startup `initDb()` (`server/db.js`) runs `server/schema.js` (idempotent `CREATE TABLE IF NOT EXISTS`, no migrations tool) and seeds `server/seed.js` only if `products` is empty. Schema changes to existing tables need manual SQL on Neon.
- Uses the `pg` Pool against Neon, not `@neondatabase/serverless`, because order placement needs real transactions.

### Identity (no auth yet)
Shoppers are anonymous. The client generates a UUID, keeps it in `localStorage` (`marketnest.clientId`), and sends it as `X-Client-Id` on every request (`src/api/client.js`). The server scopes `cart_items`, `wishlist_items` and `orders` by that `client_id`. When adding auth, this header/column is the seam to replace with a user id.

### Server is the source of truth
- `src/context/StoreContext.jsx` holds cart/wishlist/orders state; every mutation calls the API and stores the **full list the server returns**. No optimistic updates. Failures set `error`, shown as a banner in `App.jsx`. `placeOrder` is the exception: it throws so `Checkout` can show the message.
- Prices, totals and shipping are recomputed server-side. Shipping rule ($5.99, free at ≥ $100) is **duplicated** in `src/utils/money.js` (display) and `server/api.js` (authoritative); change both together.
- `POST /api/orders` runs in one transaction: locks product rows (`FOR UPDATE OF p`), checks stock (409 on shortfall), inserts the order plus `order_items` snapshots (name/emoji/price so history survives catalog changes), decrements stock, clears the cart. Don't split this up.
- `server/api.js` returns generic `Internal server error` for 5xx; keep SQL errors out of responses.

## Testing setup (non-obvious)

- Frontend tests never hit the network: `tests/setup.js` globally mocks `src/api/client.js` with an in-memory fake backend (`tests/helpers/fakeApi.js`, supports `fake.reset({cart, wishlist, orders})` and `fake.state.failures.push(/METHOD \/path/)` to force errors). `tests/helpers/render.jsx` `renderApp(route)` mounts the real `App` in a `MemoryRouter`. `tests/api-client.test.js` uses `vi.importActual` to test the real client.
- Server tests (`tests/server/api.test.js`, `@vitest-environment node`) mock `server/db.js` with an in-memory PGlite Postgres running the real `schema.js` + seed, so the actual SQL is exercised. A `control.failOn` regex forces statement failures (used for the rollback test). PGlite handles one connection, so true concurrency/oversell races can't be tested there. That was verified manually against real Postgres.
- Coverage deliberately excludes `server/db.js`, `server/index.js` and `src/main.jsx`.

## Deployment

Render Blueprint (`render.yaml`): build `npm install --include=dev && npm run build`, start `npm start`, health check `/api/health` (also queries the DB). `DATABASE_URL` is `sync: false`, set in the Render dashboard. Node 22+ is required (`--env-file-if-exists`); `NODE_VERSION=24` is pinned. Pushing to `main` of the GitHub repo triggers deploy if auto-deploy is on.
