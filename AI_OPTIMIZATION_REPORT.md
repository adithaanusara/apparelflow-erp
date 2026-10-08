# AI Optimization Report

This report documents how AI tools were used to build the ApparelFlow ERP
Cutting Operations & Gatekeeper Verification Terminal, where their output was
wrong, and how it was corrected.

## 1. Tools & Prompting

| Tool | Used for |
| ---- | -------- |
| Claude Code (Claude Opus, VS Code extension) | Day 1-2: project scaffold, Drizzle schema, migration, seed script, session/role-guard layer, order creation API and service, order dialog UI, input validation, Vitest suites, README updates |
| Claude Code (Claude Opus, VS Code extension) | Day 3-4: traffic-light rules, verification service and API, hard-stop logic, database triggers, Verifier Terminal UI, order edit/delete, Sewing Queue query/API/UI, sewing handoff migration, tests, README schema documentation |
| Claude Code (Claude Opus, VS Code extension) | UI redesign after the Day 4 feature work: enterprise UI redesign, card-based dashboards, interactive summary metrics, search bar on every workspace, Sri Lanka time localization, and the sewing completion endpoint |

**Prompting Approach:**
The work was driven iteratively using the challenge brief. I provided one clear milestone per session (e.g., "Day 1: Scaffold and Database" and "Day 2: Auth and Orders"). Before accepting any AI-generated code, I manually reviewed the logic, specifically checking database constraints, contrast/accessibility guidelines, and error handling, and instructed the AI to fix any edge cases before moving forward.

## 2. Flawed / Broken AI Code

### 2.1 Stale validation error on the sign-in form

**Where:** `src/app/login/login-form.tsx`

**What the AI generated:** the sign-in form shows field errors returned by
`POST /api/auth/login` (a `422` with `fieldErrors`). The generated code stored
them in state when the response arrived, but the `onChange` handlers only
updated the field value:

```tsx
onChange={(event) => setEmail(event.target.value)}
```

**The defect:** nothing cleared an error once it was set. After submitting an
empty form, "Email is required." and the red invalid border stayed on the email
field while a valid address was being typed into it, and remained until the
form was submitted again. The message on screen contradicted the contents of
the field. The same applied to the password field.

**Why it matters:** the brief requires immediate inline visual errors. An error
that does not react to the user's correction is wrong feedback, and
`aria-invalid` stayed `true`, so assistive technology also reported a valid
field as invalid.

**How it was caught:** not by lint, type-checking or the automated tests, all
of which passed. It was caught by driving the page in a real browser
(headless Chrome), submitting the empty form, typing an email address and
looking at the screenshot.

**Also worth noting:** the order creation dialog, generated in the same
session, handled this correctly (its `setField` clears the server error for
the edited field). The AI applied the pattern in one form and omitted it in
the other.

**Fix:** each field now clears its own error when edited.

```tsx
function clearFieldError(field: string) {
  setFieldErrors((current) => ({ ...current, [field]: "" }));
}

onChange={(event) => {
  setEmail(event.target.value);
  clearFieldError("email");
}}
```


### 2.2 Rejection-note constraint bypassed by NULL values

**Where:** `src/server/db/schema.ts`

**What the AI generated:** The AI generated a Postgres check constraint to ensure that rejected orders always include a rejection note. The original code was:

```ts
check("verification_logs_rejection_requires_note", sql`${t.decision} <> 'REJECTED' OR length(btrim(${t.rejectionNote})) > 0`)
```

**The defect:** The column `rejection_note` is nullable. When it is omitted (NULL), `length(btrim(NULL))` evaluates to NULL. In PostgreSQL, a CHECK constraint only blocks a row when the expression is strictly `false`. Since it evaluated to NULL, the database allowed the insertion.

**Why it matters:** The business rules strictly dictate a mandatory reason on every rejection. This flaw would have allowed verifiers to silently reject orders without providing the required explanation.

**How it was caught:** The AI autonomously ran the generated migration against an in-memory Postgres (PGlite) instance and attempted to insert various edge-case rows to verify its own logic. The test revealed that an empty note (" ") was blocked, but a completely missing note (NULL) was accepted. 

**Fix:** The AI identified the flaw and proposed wrapping the column in a `coalesce` function so that a NULL value is treated as an empty string, forcing the check to evaluate to `false`. I reviewed this solution to ensure it perfectly matched the strict gatekeeper business rules before accepting and integrating it.

```ts
sql`${t.decision} <> 'REJECTED' OR length(btrim(coalesce(${t.rejectionNote}, ''))) > 0`
```

### 2.3 Further defects found during Day 3 and Day 4

Each of these was in AI-generated code, passed lint and type-checking, and was
found by running the application rather than by reading it.

| # | Defect | Where | How it was found | Fix |
| - | ------ | ----- | ---------------- | --- |
| a | **Approval could crash with a 500.** Day 2's order form accepted up to 1,000,000 yards for any quantity. For a very small batch the wastage percentage exceeded the `numeric(7,2)` column it is stored in at approval, so the insert into `verification_logs` would fail. | `src/server/orders/service.ts`, `src/lib/order-input.ts` | Noticed while writing the approval transaction on Day 3, when the stored wastage value was first used. | Order creation and editing refuse fabric above 100 times the recipe standard (`422` with a field error). Covered by a test. |
| b | **Count inputs stretched across the whole card.** The input had both `w-32` and the shared `w-full` class; the shared class won, so the intended width was silently ignored. | `src/app/(app)/verification/verification-card.tsx` | Screenshot of the Verifier Terminal in headless Chrome. | The width is now set with `max-w-36`, which does not compete with `w-full`. |
| c | **Verifier table unusable on a phone.** At 390px the table scrolled sideways inside the card, cutting off the component names and the traffic lights, which are the two things the verifier needs to see. | Same file | Screenshot at phone width. | The rows were rebuilt as a grid that stacks into two lines per component on small screens. |
| d | **Status badges clipped on a phone** in the read-only count tables ("GREE" instead of "GREEN · Match"). | `src/app/(app)/sewing/page.tsx`, `src/app/(app)/cutting/page.tsx` | Screenshot at phone width on Day 4, plus a scripted check that no table is wider than its container. | The badge shows only the colour word on narrow screens, and the supervisor's table hides its per-garment column there. |
| e | **The AI's test setup broke my running dev server.** To test in a browser without writing to the Neon database, the AI temporarily patched `src/server/db/client.ts` in the working folder. My own `next dev` was running from the same folder and picked the patch up, so pages returned server errors for about a minute. | Process error, not committed code | The AI's second dev server refused to start because mine was already running, which exposed the conflict. | The patch was reverted immediately. All later browser checks ran from a separate copy of the project. |

### 2.4 Crowded Action Buttons & Half-Width Cards

**Where:** `src/app/(app)/cutting/orders-dashboard.tsx`,
`src/app/(app)/verification/verifier-workspace.tsx` and
`src/app/(app)/sewing/sewing-workspace.tsx`.

**What the AI generated:** When adding the "Edit" and "Delete" buttons with icons, the AI placed them in a flex container with only a 10px gap (`gap-2.5`). Additionally, the new order cards were laid out in a two-column grid, so a single card filled only the left half of the page and left an awkward blank area on the right.

**The defect:** The buttons sat too close together, increasing the risk of accidental destructive actions (e.g., hitting Delete instead of Edit). The UI looked unpolished and did not utilize the desktop real estate properly.

**How it was caught:** Visual inspection during my manual browser testing. Neither issue was reported by lint, type-checking or the automated tests.

**Fix:** I instructed the AI to add a wider Tailwind spacing utility between the buttons (`gap-4`) and to make the cards use the full width of their container. The verifier's pending cards now sit in a single full-width column, and in the Sewing Queue a card with no neighbour spans both columns.

## 3. Human Refactoring & Architectural Hardening

I did not treat AI output as production-ready. Each item below is a place
where the first version was changed or hardened; for each I state who found
the problem and what I decided.

* **100x fabric constraint.** While writing the approval step, the AI found that a very small batch with a large fabric figure would overflow the `numeric(7,2)` wastage column. It added a rule limiting fabric to 100 times the recipe standard. I reviewed the rule and accepted it.
* **Controlled order edit and delete.** During my manual review of the Cutting Supervisor screen I noticed there was no way to correct or remove an order entered by mistake, and asked whether the brief called for it. The AI pointed out that a re-cut changes fabric usage, so without editing the recorded wastage would be wrong. I decided to keep full edit and delete for unsubmitted orders and fabric-only editing for rejected ones.
* **State machine and database triggers.** The AI proposed enforcing the 4-state workflow (`CUTTING_IN_PROGRESS`, `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`) and the verification hard stop with Postgres constraints and triggers, in addition to the audit-log trigger I had asked for. I accepted this so the rules hold even if API-level validation is bypassed.
* **Sewing handoff architecture.** I chose to record `sewing_started_at` and `sewing_started_by` under the existing `VERIFIED` status instead of adding a fifth state, which keeps the queue query clean and isolated.
* **UI/UX and contrast validation.** The AI drove the application in headless Chrome at desktop and phone widths, with the browser set to dark mode, checked that every input renders dark text on a white background, and fixed the clipped tables and status badges it found. I reviewed the three workspaces by hand in my own browser and reported the gaps I found.

## 4. Defensive Architecture

How the state machine and the API guards prevent unauthorized status
overrides.

### 4.1 Architecture flow

Every order moves through one pipeline. Each arrow is a single endpoint, open
to a single role, that performs one named transition.

```
                 Cutting Supervisor                Cutting Verifier               Sewing Supervisor
                 ------------------                ----------------               -----------------
POST /api/orders
      |
      v
CUTTING_IN_PROGRESS --POST /api/orders/:id/submit--> PENDING_VERIFICATION
      ^  (edit, delete)                                |            |
      |                                  PUT .../counts (traffic lights derived on the server)
      |                                                |            |
      |                               POST .../reject  |            |  POST .../approve
      |                               (note required)  |            |  (422 if any component is
      |                                                v            |   RED, missing or uncounted)
      +---POST /api/orders/:id/submit------------- REJECTED         v
          (counts cleared, fabric may be corrected)             VERIFIED --> GET /api/sewing/queue
                                                                (terminal)   POST /api/sewing/queue/:id/start
```

A request passes through the same layers in the same order on every endpoint:

1. `route()` wrapper: turns every failure into one JSON error shape.
2. `requireRole()`: `401` without a valid session, `403` for the wrong role.
3. Input validation: `422` with per-field messages.
4. Service function: one database transaction that checks the current status
   and writes the result.
5. Database constraints and triggers: the last line, independent of the code
   above.

### 4.2 State machine

- The legal transitions are defined once, in `src/lib/order-rules.ts`:
  `CUTTING_IN_PROGRESS → PENDING_VERIFICATION`,
  `PENDING_VERIFICATION → VERIFIED | REJECTED`,
  `REJECTED → PENDING_VERIFICATION`. `VERIFIED` has no exits.
- No endpoint accepts a status from the client. Each endpoint performs one
  named transition. `POST /api/orders` ignores `status`, `createdBy`,
  `orderNo` and item counts in the request body; a test sends all four and
  asserts they have no effect.
- Status checks are never a read followed by a separate write. Submission
  puts the check in the `UPDATE` itself (`WHERE id = ? AND status IN (...)`).
  Counting, approving and rejecting first lock the order row
  (`SELECT ... FOR UPDATE`), so an approval cannot be decided on counts that
  another request is changing. An illegal move returns `409`.
- The same transition table is enforced again by a database trigger. A test
  tries every pair of statuses with a direct `UPDATE` and asserts that the
  database allows exactly the pairs `canTransition()` allows, so the two
  definitions cannot drift apart unnoticed.
- "Start Sewing Assembly" is not a fifth status. It is recorded as
  `sewing_started_at` and `sewing_started_by` on the order, so the state
  machine stays at four states and the Sewing Queue rule stays literally
  `status = 'VERIFIED'`.

### 4.3 API guards

- Every route handler calls `requireRole(request, ...)` before doing anything
  else. No valid session returns `401`; the wrong role returns `403`.
- The user id and role come only from the session cookie: an `httpOnly` JWT
  signed with a server-side secret and verified with a fixed algorithm. A test
  confirms that a cookie with an edited role, an `alg: none` token and a
  garbage value are all treated as signed out.
- Page redirects and hidden buttons are treated as convenience only, never as
  the security boundary.

| Endpoints | Role allowed |
| --------- | ------------ |
| `/api/orders`, `/api/orders/:id`, `/api/orders/:id/submit`, `/api/recipes` | `cutting_supervisor` |
| `/api/verification/orders`, `.../:id/counts`, `.../:id/approve`, `.../:id/reject`, `/api/verification/history` | `cutting_verifier` |
| `/api/sewing/queue`, `/api/sewing/queue/:id/start`, `/api/sewing/queue/:id/complete` | `sewing_supervisor` |

### 4.4 Verification API and the hard stop

The rule "no batch with a shortage may be approved" is enforced three times.

1. **UI.** "Approve Batch" is disabled while any component is RED, uncounted
   or invalid. This is a convenience, not a control.
2. **API** (`src/server/verification/service.ts`).
   - Saving counts: the server computes GREEN, YELLOW or RED from the stored
     expected quantity. A `status` or `expectedQty` sent by the client is
     never read.
   - Approving: the handler does not read the request body at all. Inside one
     transaction it locks the order, loads the stored counts, and applies
     `approvalBlockers()`. If any component is short, uncounted or missing it
     returns `422` naming each one, and nothing is written.
   - On success the status change and the audit row (`verifier_id` from the
     session, `timestamp` from the database clock, `wastage_pct` computed on
     the server) are written in the same transaction.
   - Rejecting requires a non-blank note (`422` otherwise). The counts are
     kept as the record of what was wrong and cleared on resubmission.
3. **Database.** A trigger refuses to set an order to `VERIFIED` while any of
   its components is uncounted or short, whatever issued the `UPDATE`.

### 4.5 Database constraints and triggers

Constraints from the initial schema (`drizzle/0000_initial_schema.sql`) and
gatekeeper triggers (`drizzle/0001_gatekeeper_triggers.sql`,
`drizzle/0002_sewing_handoff.sql`):

- Check constraints reject non-positive quantities and fabric yards.
- A partial unique index allows at most one `APPROVED` log per order, and
  check constraints enforce non-blank notes on rejections.
- Triggers on `verification_logs` enforce an append-only audit trail
  (`UPDATE`, `DELETE`, and `TRUNCATE` are blocked).
- `cutting_orders_guard` and `verification_items_guard` prevent illegal
  status transitions and protect verified data.
- Sewing triggers ensure start timestamps and users are permanent once
  recorded.
- `drizzle/0003_sewing_completion.sql` adds schema support and traceability
  columns to accurately track the completion of sewing batches.

### 4.6 Sewing Queue isolation

- `listSewingQueue()` in `src/server/sewing/service.ts` has
  `WHERE status = 'VERIFIED'` written into the query and takes no filter
  argument. The route handler passes nothing from the request to it, so no
  URL parameter or body can widen the result.
- Starting sewing on an order that is not `VERIFIED` returns the same `404`
  as an order that does not exist, so the endpoint cannot be used to probe
  for unverified orders.
- The cutting supervisor and the verifier receive `403` from both sewing
  endpoints.

### 4.7 Input validation

- One module (`src/lib/order-input.ts`) validates order input for both the
  browser form and the API, so the two cannot drift apart. The API accepts
  JSON numbers only: `"50"`, `12.5`, `-5`, `NaN` and empty payloads are
  rejected with `422` and per-field messages.
- Counts follow the same approach in `src/lib/verification-rules.ts`: whole
  numbers from 0 upward, with negatives, decimals, numeric strings and text
  rejected.
- Editing an order reuses the creation validator. On a rejected order only
  the fabric roll and fabric used may change, so the wastage recorded at
  approval reflects the re-cut while the batch the verifier counted stays
  fixed.

### 4.8 Automated tests

`npm test` runs 229 tests in about five seconds. The API tests call the real
route handlers against an in-memory Postgres (PGlite) built from the same
four migrations as production, so the constraints and triggers are
exercised, not mocked.

| File | Tests | Covers |
| ---- | ----- | ------ |
| `tests/order-rules.test.ts` | 7 | Multiplier engine, wastage formula, state machine |
| `tests/order-input.test.ts` | 41 | Order input validation and strict number parsing |
| `tests/orders-api.test.ts` | 56 | Sign-in, forged cookies, order creation, submission, edit, delete, role checks |
| `tests/verification-api.test.ts` | 56 | Traffic lights, hard stop, rejection, role checks, triggers |
| `tests/sewing-api.test.ts` | 37 | Queue isolation, start and completion of sewing, role checks, sewing database rules |
| `tests/format-date.test.ts` | 9 | Timezone localization and 12-hour AM/PM formatting for Asia/Colombo |
| `tests/order-search.test.ts` | 23 | Universal free-text search matching across different order properties |

The five tests required by the brief:

| Brief | Test name | File |
| ----- | --------- | ---- |
| Test 1 | "Test 1: lets a verifier approve an order with all GREEN components" | `verification-api.test.ts` |
| Test 2 | "Test 2: blocks approval with 422 when one component is RED" | `verification-api.test.ts` |
| Test 3 | "Test 3: refuses a rejection with ..." (six kinds of missing or blank note) | `verification-api.test.ts` |
| Test 4 | "Test 4: returns 403 when a ... tries to approve" (supervisor and sewing) | `verification-api.test.ts` |
| Test 5 | "Test 5: never returns an order that is not VERIFIED" | `sewing-api.test.ts` |

## 5. Human-in-the-Loop Notes and Reflections

### 5.1 Decisions I made and why

- **Role Switcher:** Although initially concerned about security implications, re-reading the brief highlighted that the evaluator convenience feature ("Switch to Verifier") is necessary. I decided to keep the Role Switcher while ensuring strict security boundaries and role guards remain firmly enforced at the backend session validation layer.
- **Edit and delete for cutting orders:** While not explicitly required by the brief, I identified that editing and deleting unsubmitted orders was necessary. When the AI pointed out that a re-cut changes fabric usage, I decided that rejected orders needed a restricted edit flow on fabric fields so that wastage is recalculated correctly on re-cuts.
- **`sewing_started_at` instead of a fifth status:** Rather than complicating the state machine with a fifth database status, I chose a cleaner architecture by tracking `sewing_started_at` and `sewing_started_by` directly under the existing `VERIFIED` status.
- **Database triggers beyond the audit log:** The AI proposed enforcing hard stops and the state machine at the database level using triggers. I accepted this approach because the database refuses unauthorized status updates even if the API layer is bypassed.

### 5.2 What I reviewed by hand, and what I found

I did not blindly accept the AI-generated code. UI and validation issues—such as the login form's stale error state—were caught by driving the application in a real browser. On the backend, the AI's own database test caught the flaw where its rejection-note constraint failed to handle `NULL` values; I reviewed the `coalesce` fix before accepting it. My own manual review of the running application found the missing edit and delete options for cutting orders and prompted the Role Switcher decision above.

### 5.3 Bug-fix insights

AI-generated code generally handles happy paths well, but subtle edge cases—such as PostgreSQL check constraints handling null values via `length(btrim(NULL))` or real-time inline form validation clearing states—can easily slip through. Rigorous manual testing of edge cases and database-level constraints is essential to catch these issues before deployment.

### 5.4 Reflections on working with AI

While the AI excelled at rapidly bootstrapping codebases, generating comprehensive test suites, and setting up API endpoints, it required strict steering for fine-grained business logic and real-world UI/UX edge cases. Combining rapid AI code generation with hands-on architectural refactoring and manual testing ensured the system met high professional standards.

## 6. Enterprise UI Redesign & Dashboard Optimization

To elevate the application from a functional prototype to a production-ready enterprise tool, I directed several major UX improvements, which the AI implemented:

* **Card-Based Interface:** Rebuilt the Cutting Verifier and Sewing Supervisor workspaces from long stacked records into compact summary cards, with the full record (count tables and audit history) opened in a dialog, significantly enhancing readability on the factory floor. The Cutting Supervisor's order table became a dashboard with status tabs and expandable rows.
* **Interactive Summary Metrics:** Implemented dynamic, clickable top-level summary cards (e.g., Pending, Approved, Rejected). These act as filters for the list below them, removing the need for cluttered side-panels.
* **Universal Search Functionality:** Integrated a real-time, free-text search bar on all three workspaces. This allows a user to instantly filter the open view by Order Number, Product Name, or the Supervisor's or Verifier's Name.
* **Timezone Localization:** Replaced the per-page UTC date formatting with one shared timestamp utility (`src/lib/format-date.ts`) that displays every event in Sri Lanka Standard Time (`Asia/Colombo`) using a highly readable 12-hour AM/PM format, ensuring the UI reflects the actual physical location of the factory. Timestamps are still stored in UTC.
