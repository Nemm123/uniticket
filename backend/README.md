# UniTicket Backend

Node.js + Express + TypeScript API foundation for UniTicket. This service is separate from the existing Vite frontend and currently exposes a database-aware health endpoint.

## Requirements

- Node.js 20 or newer
- PostgreSQL 15 or newer

## Install and configure

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `.env` with the PostgreSQL connection details. The default expects a local database named `uniticket` with user/password `postgres`.

Create the database from `psql` or pgAdmin, then apply the migration:

```powershell
psql "$env:DATABASE_URL" -f migrations/001_create_events.sql
```

## Run

```powershell
npm run dev
```

The API listens on `http://localhost:4000` by default.

## Health check

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

The endpoint returns HTTP 200 when PostgreSQL is reachable and HTTP 503 with `{ "status": "degraded" }` when the API is running but the database is unavailable.

## Events API

All event responses use `{ "data": ... }`. Event writes run in a PostgreSQL transaction, including their ticket tiers.

- `GET /api/events` — list events with ticket tiers.
- `GET /api/events/:id` — get one event.
- `POST /api/events` — create an event and its tiers.
- `PUT /api/events/:id` — replace event details and tiers.
- `DELETE /api/events/:id` — delete an event and its tiers.

Create/update payload example:

```json
{
  "organizerWallet": "demo-organizer",
  "title": "UniHackFest Demo Night",
  "subtitle": "Web3 builders and beats",
  "description": "A local demo event.",
  "category": "Web3 Hackathon",
  "bannerImage": "https://example.com/banner.jpg",
  "thumbnailImage": "https://example.com/thumb.jpg",
  "date": "2026-12-05",
  "time": "17:00 - 23:00",
  "venue": "Saigon Innovation Hub",
  "city": "Ho Chi Minh City",
  "status": "draft",
  "featured": false,
  "tags": ["Web3"],
  "lineup": [],
  "tiers": [
    {
      "name": "General Admission",
      "description": "Standard access",
      "priceSol": 0.5,
      "perks": ["Entry"],
      "totalQuantity": 100,
      "remainingQuantity": 100
    }
  ]
}
```

## Build

```powershell
npm run typecheck
npm run build
npm start
```

The frontend calls this API at `http://localhost:4000` and keeps a localStorage
mirror during the migration. Existing ticket and check-in records are not
deleted. Set `VITE_API_BASE_URL` if the API is hosted at another URL.
