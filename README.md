# Velle Inventory Management

A warehouse inventory tracker for Velle — tracks daily stock movement (sold / collected / returned), damage returns with photo evidence, and documents (Delivery Orders, Purchase Orders, Monthly Bills).

## What's already set up

- Vite + React scaffold, ready to run
- `recharts` installed for the dashboard charts
- Google Fonts (Inter) wired into `index.html`
- All app code lives in `src/App.jsx` — single file, matches the version built in Claude chat
- Production build tested and working (`npm run build`)

## Getting started

```bash
npm install
npm run dev
```

Open the local URL it gives you (usually `http://localhost:5173`).

To build for production:

```bash
npm run build
```

## Demo login

- Salesperson PIN: `0000`
- Admin PIN: `1234`

## Current state

Everything currently runs on in-memory React state (`useState`) — refreshing the page wipes all data. The dashboard is pre-seeded with 14 days of sample data so the charts aren't empty on first load.

## What to ask Claude Code to do next

1. **Persistence** — wire up Firebase Firestore (same pattern as the RenoLedger project) so logs, damage reports, documents, and users survive a refresh.
2. **Real user accounts** — move off hardcoded PINs into a proper Firebase Auth or Firestore-backed user table.
3. **Photo storage** — currently photos are stored as base64 in memory; move to Firebase Storage so they don't bloat local state.
4. **Code splitting** — the build is currently a single ~640kB JS bundle; recharts is the main contributor. Worth lazy-loading the dashboard charts.
5. **Deploy** — push to Vercel or Netlify once persistence is in place.

## Project structure

```
velle-inventory-management/
├── index.html          ← fonts + page title
├── src/
│   ├── App.jsx          ← entire app (pages, modals, charts, login)
│   ├── main.jsx          ← React entry point
│   ├── App.css            ← empty, all styling is inline in App.jsx
│   └── index.css           ← empty
├── package.json
└── vite.config.js
```
