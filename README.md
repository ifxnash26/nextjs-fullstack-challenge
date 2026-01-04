## Task & Notes

Credentials-based auth with sessions plus CRUD for tasks and notes, built on Next.js (App Router) and Prisma/PostgreSQL.

## How to run locally

1) Copy `.env.example` to `.env` and set `DATABASE_URL` (do not commit `.env`).
2) Install deps: `npm install`
3) Start Postgres (if using local Docker): `docker compose up -d`
4) Apply schema: `npx prisma migrate dev --name init`
5) Start dev server: `npm run dev`
6) Lint/tests: `npm run lint` and `npm run test`
