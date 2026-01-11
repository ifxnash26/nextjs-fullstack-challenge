# AssetSpace AI

Notion-like workspace for IT asset inventory with role-based access control, CSV import/export, and AI-assisted filters/summaries.

## Stack
- Next.js (App Router) + TypeScript + Tailwind/shadcn-style UI
- NextAuth (credentials) with Prisma/PostgreSQL database sessions
- Prisma schema/migrations ready for Neon/Vercel deployment
- Zod validation, Vitest unit tests

## Getting Started
1) Install dependencies:
```bash
npm install
```

2) Copy environment variables:
```bash
cp .env.example .env
```
Fill in `DATABASE_URL`, `NEXTAUTH_SECRET`, and (optionally) `AI_API_KEY`.

3) Generate Prisma client and apply migrations:
```bash
npm run prisma:generate
npm run migrate:dev   # requires a reachable Postgres database
```

4) (Optional) Seed an admin and workspace:
```bash
npm run prisma:seed    # uses SEED_* values from .env
```

5) Start the app:
```bash
npm run dev
```

## Features
- Auth: credentials login with database-backed sessions.
- Roles: `ADMIN`, `IT_STAFF`, `VIEWER` enforced server-side.
- Workspace access: only members can access `/w/[id]/...`.
- Assets: CRUD with fields (assetTag unique per workspace, serialNumber, category, brand, model, status, location, purchaseDate, warrantyEnd, assignedTo Person, notes).
- Views:
  - `/w/[id]/assets` – table with search/filter/sort and AI-assisted filter input.
  - `/w/[id]/assets/board` – kanban by status.
  - `/w/[id]/assets/[assetId]` – detail, notes (Markdown), activity log, AI summary stub.
- Import/Export: CSV import (basic) and filtered CSV export.
- Admin: `/admin/users` to create users, set roles, and attach to a workspace.

## AI stubs (v1.5)
- Ask AI: `/api/ai/filter` converts free text to a FilterSpec (string/regex heuristics, no external calls).
- Summaries: `/api/assets/[assetId]/summary` returns a short summary from notes/activity (stubbed when `AI_API_KEY` is unset).

## Prisma
- Schema: `prisma/schema.prisma`
- Migration: `prisma/migrations/0001_init/migration.sql`
- Seed script: `prisma/seed.js`

## Testing
```bash
npm test
```
Vitest covers zod validators and asset service logic.

## Verification Commands
- Lint: `npm run lint`
- Build: `npm run build`
- Tests: `npm test`
- Migrate: `npm run migrate:dev` (development) or `npm run migrate:deploy` (deploy)

## Deployment Notes
- Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` in the hosting provider.
- Neon-friendly: use the provided Prisma schema/migration; run `npm run migrate:deploy` during deploy.
- Vercel: add env vars, enable `NODE_OPTIONS="--max-old-space-size=1024"` if needed for build sizes.
