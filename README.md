## ETradie
ETradie is a web application that connects homeowners who need trade work (plumbing, electrical, heating, etc.) with nearby tradespeople in real time. Homeowners post jobs with title, description, category, and location; jobs are geocoded and broadcast to tradespeople within a radius. Tradespeople see incoming requests on a dashboard, accept or decline, and can message the homeowner once a job is accepted. Completed jobs support mutual reviews. Tradespeople can set standard working hours, mark themselves available for new work, and appear online while logged in; homeowners and tradespeople can view each other’s public profiles with ratings and review history.
The backend is Node.js and Express, with PostgreSQL via Prisma, JWT authentication (jsonwebtoken + bcryptjs), Zod request validation, express-rate-limit, and Socket.IO for live job broadcasts and messaging. The frontend is React with Vite, React Router, Axios, and react-hot-toast for feedback. Automated tests include Jest (validators, Haversine distance, API flows with Supertest) and Vitest with React Testing Library on the frontend.
---
## Stack
| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | React 18, Vite, React Router, Axios, Socket.IO client |
| Backend  | Node.js, Express 4                              |
| Database | PostgreSQL via Prisma ORM                       |
| Real-time| Socket.IO                                       |
| Auth     | JWT (jsonwebtoken), bcryptjs                    |
---
## Prerequisites
- Node.js 18+ (LTS recommended)
- PostgreSQL (local or hosted, e.g. Render PostgreSQL)
- npm
---
## Quick Start
### 1. Clone and install
```bash
git clone <repo-url>
cd ETradie
cd backend && npm install
cd ../frontend && npm install
2. Configure backend environment
Create backend/.env (see backend/.env.example if present):

DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/etradie"
JWT_SECRET=change_me_to_a_long_random_string
PORT=4000
CLIENT_URL=http://localhost:5173
3. Database migrate and seed
cd backend
npx prisma migrate dev
npx prisma db seed
The seed creates demo accounts (see backend/prisma/seed.js for emails and passwords).

4. Configure frontend (optional)
Create frontend/.env if the API is not on the default URL:

VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
5. Run in development
Open two terminals:

# Terminal 1 — API + Socket.IO (default http://localhost:4000)
cd backend
npm run dev

# Terminal 2 — React app (default http://localhost:5173)
cd frontend
npm run dev
