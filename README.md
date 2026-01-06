## Task & Notes

Credentials-based auth with sessions plus CRUD for tasks and notes, built on Next.js (App Router) and Prisma/PostgreSQL.

## How to run locally

1) Copy `.env.example` to `.env` and set `DATABASE_URL` (do not commit `.env`).
2) Install deps: `npm install`
3) Start Postgres (if using local Docker): `docker compose up -d`
4) Apply schema: `npx prisma migrate dev --name init`
5) Start dev server: `npm run dev`
6) Lint/tests: `npm run lint` and `npm run test`

## Deployment (Vercel + Neon)
- In Vercel Environment Variables (Preview + Production), set `DATABASE_URL` to the Neon pooled connection string and `DIRECT_URL` to the direct/unpooled connection string (migrations read `DIRECT_URL` first).
- In Vercel build settings, set the Build Command to `npm run vercel-build`.
- Production migrations use `prisma migrate deploy` (never `migrate dev` in production).
- Prisma Client generation runs during build via `prebuild`/`postinstall` and the `vercel-build` script.


## Live Demo: https://nextjs-fullstack-challenge-cjw5ivolq-ifxnash26s-projects.vercel.app

## Health: https://nextjs-fullstack-challenge-cjw5ivolq-ifxnash26s-projects.vercel.app/api/health
