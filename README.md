# DST Control Panel

Control plane for the Dynamic SEO Translator WordPress plugin.

This app is the remote authority for:

- license activation and plan rights
- release publishing and package delivery
- mandatory update policy
- hard lock decisions that stop runtime services but keep admin recovery available

## Current status

This panel now supports two modes:

- `database mode`: live Prisma + Postgres data
- `demo fallback`: safe in-memory preview when `DATABASE_URL` is not configured

It already includes:

- a dashboard that reflects the chosen hard-lock model
- Prisma schema for licenses, activations, releases, policies, and request logs
- Prisma client wiring with safe demo fallback
- plugin-facing API routes under `src/app/api/plugin/*`
- typed control response contracts in `src/lib/contracts.ts`
- a seed script for local/demo records

It does not yet include:

- authentication
- release uploads
- signed downloads
- WordPress-side signed request verification

## Local development

```bash
npm install
npm run db:generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `.env.local` from `.env.example`.

```bash
Copy-Item .env.example .env.local
```

If you want real database mode, set a Postgres connection string and then run:

```bash
npm run db:push
npm run db:seed
```

If `DATABASE_URL` is empty, the app still works in demo fallback mode.

## Plugin API surface

- `POST /api/plugin/license/activate`
- `POST /api/plugin/license/check`
- `POST /api/plugin/heartbeat`
- `GET /api/plugin/update-manifest`
- `GET /api/plugin/download`

## Recommended next pass

1. Add admin auth and protected dashboard sections.
2. Add release upload flow and signed package delivery.
3. Update the WordPress plugin to cache control responses and respect hard lock mode.
4. Replace plain shared-secret access with signed request verification.
5. Deploy to Vercel and set `APP_BASE_URL`, `DATABASE_URL`, and `PLUGIN_SHARED_SECRET`.
