# ETradie

ETradie is a web application that connects homeowners with local tradespeople in real time - like “Uber for tradespeople”. Homeowners post job requests with a trade category and location; jobs are geocoded and broadcast to nearby tradespeople, who can accept or decline from a live dashboard. Once a job is accepted, both parties can exchange messages on the job, and after completion they can leave reviews and view public profiles with ratings, working hours, and availability. The platform supports two roles - homeowner and tradesperson, with JWT-protected routes and role-appropriate screens throughout.

The backend is built with Node.js and Express, using PostgreSQL with Prisma for data persistence and JWT for stateless authentication (bcrypt password hashing). Real-time updates use Socket.IO for new jobs, chat messages, and in-app notifications. Security is enforced through Zod request validation, express-rate-limit on auth and API routes, and CORS configuration. Geocoding uses Nominatim (OpenStreetMap) for addresses and towns. The React 18 frontend uses Vite, React Router, Axios, react-hot-toast, and a Socket.IO client with auth. The backend includes Jest tests (validators, Haversine distance, and Supertest API flows); the frontend uses Vitest and React Testing Library for selected pages.

---

## Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | React 18, Vite, React Router, Axios, Socket.IO client |
| Backend  | Node.js, Express 4, Socket.IO                 |
| Database | PostgreSQL via Prisma ORM                       |
| Auth     | JWT (jsonwebtoken + bcryptjs)                   |

---

## Prerequisites

- Node.js 18+
- PostgreSQL running locally or a hosted instance (connection string for `DATABASE_URL`)

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd ETradie
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

Backend — copy and edit:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` (minimum):

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/db_etradie
JWT_SECRET=change_me_to_something_random
PORT=4000
CLIENT_URL=http://localhost:5173
```

Frontend (optional — defaults assume API on port 4000):

```
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

### 3. Database migrate and seed

```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

This creates schema and seeds demo accounts:

| Email                     | Password      | Role         |
|---------------------------|---------------|--------------|
| homeowner@example.com     | Password123!  | homeowner    |
| tradesperson@example.com  | Password123!  | tradesperson |

### 4. Run in development

Open two terminals:

```bash
# Terminal 1 — API + Socket.IO (http://localhost:4000)
cd backend
npm run dev
```

```bash
# Terminal 2 — Vite dev server (http://localhost:5173)
cd frontend
npm run dev
```

### 5. Tests

```bash
cd backend
set NODE_ENV=test
npm test
```

```bash
cd frontend
npm test
```

---

## Deploying

See [DEPLOY.md](./DEPLOY.md) for deploying the API, static frontend, and PostgreSQL (e.g. Render). The repo may include a `render.yaml` blueprint.

---

## License
