# ApparelFlow ERP — Cutting Operations & Gatekeeper Verification Terminal

A full-stack implementation of the cutting-department quality checkpoint for
ApparelFlow ERP: cutting orders are created from production recipes, verified
component by component, and released to the Sewing Queue only after an
authorized verifier signs off.

> **Status:** project skeleton. Features are being added incrementally; this
> README is updated as each part lands.

## Tech stack

| Layer     | Choice                               |
| --------- | ------------------------------------ |
| Framework | Next.js 16 (App Router) + React 19   |
| Language  | TypeScript (strict)                  |
| Styling   | Tailwind CSS 4                       |
| Linting   | ESLint 9 with `eslint-config-next`   |
| Database  | PostgreSQL (Neon) via Drizzle ORM    |

## Getting started

Requires Node.js 22 or later and a PostgreSQL database (Neon).

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL
npm run db:migrate           # create the tables
npm run db:seed              # recipes and demo users
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Command             | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the development server     |
| `npm run build`     | Create a production build        |
| `npm start`         | Serve the production build       |
| `npm run lint`      | Run ESLint                       |
| `npm run typecheck` | Type-check without emitting files |
| `npm run db:generate` | Generate a SQL migration from the schema |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL` |
| `npm run db:seed`     | Seed recipes and demo users (idempotent) |

## Project structure

```
src/
  app/            Next.js App Router: pages, layouts, and API route handlers
    layout.tsx    Root layout and page metadata
    page.tsx      Landing page (placeholder)
    globals.css   Global styles (Tailwind entry point)
  server/db/      Server-only database layer
    schema.ts     Drizzle schema: tables, enums, constraints, relations
    client.ts     Neon connection (created lazily)
    migrate.ts    Applies migrations
    seed.ts       Seeds the two recipes and three demo users
drizzle/          Generated SQL migrations
```
