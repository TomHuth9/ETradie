# Deploying ETradie on Render

Deploy the backend (API + Socket.IO), frontend (static React app), and PostgreSQL on [Render](https://render.com).

## 1. Create a PostgreSQL database

1. In [Render Dashboard](https://dashboard.render.com), click **New** → **PostgreSQL**.
2. Name it (e.g. `etradie-db`), choose region and plan (Free is fine for testing).
3. Create. Copy the **Internal Database URL** (or External if you’ll connect from outside Render). You’ll use this as `DATABASE_URL`.

## 2. Deploy the backend (API)

1. **New** → **Web Service**.
2. Connect your Git repo and set:
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npm start`
3. **Environment** (add these):
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = (paste the PostgreSQL URL from step 1)
   - `JWT_SECRET` = (generate a long random string, e.g. `openssl rand -hex 32`)
   - `CLIENT_URL` = leave empty for now; set after the frontend is deployed (e.g. `https://etradie-web.onrender.com`)
   - `GEOCODE_USER_AGENT` = `ETradie/1.0 (https://yourapp.com; production)` (optional)
4. **Advanced** → **Pre Deploy Command:** `npx prisma migrate deploy && npx prisma db seed`  
   This runs before every deploy: migrations apply table changes, and the seed only adds demo users/jobs when the database is empty (no Shell needed).
5. Create Web Service. Wait for the first deploy. Note the URL (e.g. `https://etradie-api.onrender.com`).

## 3. Deploy the frontend (static site)

1. **New** → **Static Site**.
2. Connect the same repo and set:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
3. **Environment** (must be set before build so Vite bakes them in):
   - `VITE_API_URL` = your backend URL, e.g. `https://etradie-api.onrender.com`
   - `VITE_SOCKET_URL` = same as above (Socket.IO uses the same host)
4. Create Static Site. Note the frontend URL (e.g. `https://etradie-web.onrender.com`).

## 4. Point backend at the frontend

1. Go back to the **backend** Web Service → **Environment**.
2. Set `CLIENT_URL` to your frontend URL (e.g. `https://etradie-web.onrender.com`).  
   This is used for CORS and Socket.IO. Save; Render will redeploy.

## 5. (Optional) Use the Blueprint

Instead of creating services by hand, you can use the repo’s `render.yaml`:

1. **New** → **Blueprint**; connect the repo.
2. Render will create the two services from the YAML. You still must:
   - Create a PostgreSQL instance and set `DATABASE_URL` on the API service.
   - Set `JWT_SECRET`, `CLIENT_URL`, `VITE_API_URL`, and `VITE_SOCKET_URL` as above.
   - Set **Pre Deploy Command** in the dashboard so migrations and seed run on deploy (no Shell needed).

**If your backend was created without a Pre Deploy Command:** In the backend service go to **Settings** → **Advanced** → **Pre Deploy Command** and set it to `npx prisma migrate deploy && npx prisma db seed`, then trigger a **Manual Deploy**. That will create the tables and seed demo data.

## Notes

- **Free tier:** Backend may spin down after inactivity; first request can be slow. PostgreSQL has a 90-day limit on the free plan.
- **Socket.IO:** Works on Render. If you add a custom domain, use it in `CLIENT_URL` and `VITE_SOCKET_URL`.
- **Seed behaviour:** The seed only runs when the database has no users, so it won’t overwrite existing data on later deploys.
