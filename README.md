# ETradie

ETradie is a web app that connects homeowners with local tradespeople in real time — like “Uber for tradespeople”. Homeowners post jobs; nearby tradespeople see them live and can accept or decline.

## Tech stack

- **Backend:** Node.js, Express, Socket.IO, PostgreSQL, Prisma, JWT
- **Frontend:** React (Vite), React Router, Axios, Socket.IO client
- **Auth:** JWT; optional forgot-password flow (dev: reset token in API response)

## Prerequisites

- Node.js 18+
- PostgreSQL
- (Optional) nvm for Node version management

## Setup

### 1. Database

Create a PostgreSQL database (e.g. `db_etradie`) and note the connection URL.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, PORT, CLIENT_URL, GEOCODE_USER_AGENT
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Backend runs at `http://localhost:4000` by default.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` by default. Set `VITE_API_URL` and `VITE_SOCKET_URL` if your API/Socket server is elsewhere.

## Environment variables

**Backend (`.env`):**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `PORT` | Server port (default 4000) |
| `CLIENT_URL` | Allowed CORS origin (e.g. http://localhost:5173) |
| `GEOCODE_USER_AGENT` | User-Agent for Nominatim (OpenStreetMap) geocoding |

**Frontend (optional):**

- `VITE_API_URL` — API base URL (default http://localhost:4000)
- `VITE_SOCKET_URL` — Socket.IO server URL (default same as API)

## Seed accounts

After `npx prisma db seed`:

- **Homeowner:** `homeowner@example.com` / `Password123!`
- **Tradesperson:** `tradesperson@example.com` / `Password123!`

## Features

- **Homeowners:** Register, post jobs (title, description, category, location), view “Your jobs” with filters and pagination, cancel/close/complete jobs, message accepted tradesperson, leave reviews.
- **Tradespeople:** Register (town/city, trade categories, availability), see nearby pending jobs in real time and on load, filter by category, accept/decline, message homeowner, complete job, get reviewed.
- **Profile:** Edit name, address/town, (tradesperson) availability and categories; change password. Forgot password (dev: token in response; production: wire up email).
- **Discovery:** Public tradesperson profile page (name, town, rating, categories, availability).
- **Real time:** New jobs broadcast to nearby tradespeople; new messages pushed to both participants.
- **API:** Request validation (Zod), rate limiting on auth and API routes.

## API overview

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/profile`, `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- `GET /trades/categories`
- `POST /jobs`, `GET /jobs/my`, `GET /jobs/nearby`, `GET /jobs/:id`, `POST /jobs/:id/respond`, `POST /jobs/:id/cancel`, `POST /jobs/:id/close`, `POST /jobs/:id/complete`
- `GET /jobs/:id/messages`, `POST /jobs/:id/messages`
- `GET /jobs/:id/reviews`, `POST /jobs/:id/reviews`
- `GET /users/:id/profile`, `GET /users/:id/rating`

## Migrations

Run new migrations with:

```bash
cd backend
npx prisma migrate dev
```

Commit the new migration files under `prisma/migrations/`.

## License

MIT
