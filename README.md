# MarketNest

A small full-stack online shop: browse products, wishlist, cart, checkout and order history.

React 19 + Vite SPA served by one Express process, Postgres (Neon) via `pg`, deployed as a single Render web service.

## Run
```
cp .env.example .env     # set DATABASE_URL to your Neon connection string
npm install
npm run dev              # http://localhost:3000
```

## Check
```
npm run lint && npm run test:coverage && npm run build
```
Tests need no database (PGlite runs the real SQL). See `CLAUDE.md` for architecture and deployment.
