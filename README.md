# ApparelFlow ERP — Cutting Operations & Gatekeeper Verification Terminal

A full-stack implementation of the cutting-department quality checkpoint for
ApparelFlow ERP: cutting orders are created from production recipes, verified
component by component, and released to the Sewing Queue only after an
authorized verifier signs off.

> **Status:** all three workspaces are built: the Cutting Supervisor's order
> engine, the Verification Terminal with its hard stop, and the Sewing Queue.

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
| `PUT /api/orders/:id`         | cutting_supervisor | Corrects an order (same body as create). `CUTTING_IN_PROGRESS`: all fields. `REJECTED`: fabric roll and fabric used only. `409` once pending or verified |
| `DELETE /api/orders/:id`      | cutting_supervisor | Deletes an order that was never submitted (`CUTTING_IN_PROGRESS`). `409` otherwise |
| `POST /api/orders/:id/submit` | cutting_supervisor | Moves `CUTTING_IN_PROGRESS` or `REJECTED` to `PENDING_VERIFICATION`. `409` from any other status |
| `GET /api/verification/orders` | cutting_verifier  | Orders in `PENDING_VERIFICATION` only |
| `PUT /api/verification/orders/:id/counts` | cutting_verifier | Saves counts as `{ "counts": [{ "componentId", "actualQty" }] }`. The server derives each traffic light |
| `POST /api/verification/orders/:id/approve` | cutting_verifier | Moves the order to `VERIFIED` and writes the audit log. `422` if any component is RED, missing or uncounted |
| `POST /api/verification/orders/:id/reject` | cutting_verifier | Body `{ "note" }`. Moves the order to `REJECTED`. `422` without a note |
| `GET /api/sewing/queue`       | sewing_supervisor  | `VERIFIED` batches only, with piece counts, verifier sign-off, stored wastage % and earlier rejection notes |
| `POST /api/sewing/queue/:id/start` | sewing_supervisor | Records "Start Sewing Assembly" (who and when). `409` if already started; `404` for any order that is not `VERIFIED` |

Any other role calling a verification or sewing endpoint gets `403`.

Creating an order derives the expected piece count for every recipe component
(target quantity x pieces per garment) on the server and stores them as
`verification_items` in the same transaction.

## The gatekeeper hard stop

| Status | Rule              | Effect                                  |
| ------ | ----------------- | --------------------------------------- |
| GREEN  | actual = expected | Passes                                  |
| YELLOW | actual > expected | Surplus recorded; the batch may proceed |
| RED    | actual < expected | Shortage; approval is blocked           |

The rule is enforced in three places, each independent of the one before it:

1. **UI:** "Approve Batch" is disabled while any component is RED, uncounted
   or invalid.
2. **API:** approval reads the counts stored in the database inside a
   transaction that locks the order, ignores the request body, and returns
   `422` listing the blocking components. The verifier id comes from the
   session and the timestamp from the database.
3. **Database triggers** (`drizzle/0001_gatekeeper_triggers.sql`), which hold
   even for a query that bypasses the API:
   - an order cannot become `VERIFIED` while a component is uncounted or short;
   - status changes must follow the state machine, and new orders must start
     as `CUTTING_IN_PROGRESS`;
   - `verification_logs` is append-only (no update, delete or truncate);
   - the counts and batch data of a `VERIFIED` order cannot be changed or
     deleted.

On approval the verifier id, timestamp and wastage % are written to
`verification_logs`; the component count variances are the frozen
`verification_items` rows.

## Sewing Queue isolation

- The queue query has `WHERE status = 'VERIFIED'` written into it
  (`listSewingQueue` in `src/server/sewing/service.ts`). The function takes no
  filter argument and the route passes nothing from the request, so URL
  parameters cannot widen it.
- Starting sewing on an order that is not `VERIFIED` returns the same `404`
  as an order that does not exist, so the sewing floor learns nothing about
  unverified work.
- "Start Sewing Assembly" is stored as `sewing_started_at` and
  `sewing_started_by` on the order rather than as a fifth status. The order
  stays `VERIFIED`, the state machine keeps its four states, and the queue
  rule stays literally `status = 'VERIFIED'`. The database only accepts a
  start on a `VERIFIED` order and makes the start record permanent
  (`drizzle/0002_sewing_handoff.sql`).

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
      cutting/      Cutting Supervisor: order list, create/edit dialog, delete
      verification/ Cutting Verifier: count entry, approve and reject
      sewing/       Sewing Supervisor: verified batches, start sewing
  components/       Shared client components and control styles
  lib/              Rules shared by browser and server: roles, order state
                    machine, multiplier and wastage maths, traffic-light
                    rules, input validation
  server/           Server-only code
    auth/           Session tokens, login, API and page guards
    orders/         Order service (create, edit, delete, list, submit)
    verification/   Counts, approval hard stop and rejection
    sewing/         Sewing Queue query and start of sewing
    db/             Drizzle schema, Neon client, migrate and seed scripts
    http.ts         Error type and route wrapper for consistent API errors
tests/              Vitest suites and the in-memory test database
drizzle/            SQL migrations (schema, gatekeeper triggers, sewing handoff)
```
