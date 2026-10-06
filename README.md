# ApparelFlow ERP — Cutting Operations & Gatekeeper Verification Terminal

A full-stack implementation of the cutting-department quality checkpoint for
ApparelFlow ERP: cutting orders are created from production recipes, verified
component by component, and released to the Sewing Queue only after an
authorized verifier signs off.

> **Status:** authentication, role switching and the Cutting Supervisor's order
> engine are built. The Verification Terminal and Sewing Queue are placeholders
> and come next; this README is updated as each part lands.

## Tech stack

| Layer     | Choice                               |
| --------- | ------------------------------------ |
| Framework | Next.js 16 (App Router) + React 19   |
| Language  | TypeScript (strict)                  |
| Styling   | Tailwind CSS 4                       |
| Linting   | ESLint 9 with `eslint-config-next`   |
| Database  | PostgreSQL (Neon) via Drizzle ORM    |
| Auth      | bcrypt password hashes, signed JWT session cookie (`jose`) |
| Tests     | Vitest against in-memory Postgres (PGlite) |

## Getting started

Requires Node.js 22 or later and a PostgreSQL database (Neon).

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL and SESSION_SECRET
npm run db:migrate           # create the tables
npm run db:seed              # recipes and demo users
npm run dev
```

Open <http://localhost:3000>.

| Variable         | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `DATABASE_URL`   | Neon pooled connection string                            |
| `SESSION_SECRET` | Signs the session cookie; at least 32 characters (`openssl rand -base64 32`) |

Both must also be set in the hosting provider's environment settings.

## Demo credentials

The sign-in page shows these with a one-click button for each, and the header
has a Role Switcher that signs in as the chosen role.

| Role               | Email                         | Password         |
| ------------------ | ----------------------------- | ---------------- |
| Cutting Supervisor | `supervisor@apparelflow.demo` | `Supervisor@123` |
| Cutting Verifier   | `verifier@apparelflow.demo`   | `Verifier@123`   |
| Sewing Supervisor  | `sewing@apparelflow.demo`     | `Sewing@123`     |

## How access control works

- Signing in checks the bcrypt hash and sets an `httpOnly`, `SameSite=Lax`
  cookie holding a JWT signed with `SESSION_SECRET` (8 hour expiry).
- Every API route calls `requireRole(request, ...)` first. No session returns
  `401`; a session with the wrong role returns `403`.
- The acting user and role always come from the verified cookie. Fields such
  as `createdBy`, `status` or `orderNo` in a request body are ignored.
- Page redirects and hidden buttons are convenience only. The API guards and
  database constraints are the security boundary.

## API

All bodies are JSON. Errors have the shape
`{ "error": { "code", "message", "fieldErrors?" } }`.

| Method & path                 | Role               | Result |
| ----------------------------- | ------------------ | ------ |
| `POST /api/auth/login`        | public             | Sets the session cookie. `401` on bad credentials |
| `POST /api/auth/logout`       | any                | Clears the session cookie |
| `GET /api/auth/me`            | signed in          | Current user |
| `GET /api/recipes`            | cutting_supervisor | Recipes with components |
| `GET /api/orders`             | cutting_supervisor | All cutting orders |
| `POST /api/orders`            | cutting_supervisor | Creates an order in `CUTTING_IN_PROGRESS`. `422` with field errors on invalid input |
| `POST /api/orders/:id/submit` | cutting_supervisor | Moves `CUTTING_IN_PROGRESS` or `REJECTED` to `PENDING_VERIFICATION`. `409` from any other status |

Creating an order derives the expected piece count for every recipe component
(target quantity x pieces per garment) on the server and stores them as
`verification_items` in the same transaction.

## Scripts

| Command             | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the development server     |
| `npm run build`     | Create a production build        |
| `npm start`         | Serve the production build       |
| `npm run lint`      | Run ESLint                       |
| `npm run typecheck` | Type-check without emitting files |
| `npm test`          | Run the automated tests           |
| `npm run db:generate` | Generate a SQL migration from the schema |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL` |
| `npm run db:seed`     | Seed recipes and demo users (idempotent) |

## Project structure

```
src/
  app/              Next.js App Router
    api/            Route handlers (auth, recipes, orders)
    login/          Sign-in page and demo credential panel
    (app)/          Signed-in shell with the Role Switcher
      cutting/      Cutting Supervisor: order list and creation dialog
      verification/ Cutting Verifier workspace (placeholder)
      sewing/       Sewing Queue (placeholder)
  components/       Shared client components and control styles
  lib/              Rules shared by browser and server: roles, order state
                    machine, multiplier and wastage maths, input validation
  server/           Server-only code
    auth/           Session tokens, login, API and page guards
    orders/         Order service (create, list, submit)
    db/             Drizzle schema, Neon client, migrate and seed scripts
    http.ts         Error type and route wrapper for consistent API errors
tests/              Vitest suites and the in-memory test database
drizzle/            Generated SQL migrations
```
