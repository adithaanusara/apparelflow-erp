# AI Optimization Report

This report documents how AI tools were used to build the ApparelFlow ERP
Cutting Operations & Gatekeeper Verification Terminal, where their output was
wrong, and how it was corrected.

> **Draft status:** covers work up to Day 2 (authentication, Role Switcher,
> order engine). Items marked **TODO** are still to be written.

## 1. Tools & Prompting

| Tool | Used for |
| ---- | -------- |
| Claude Code (Claude Opus, VS Code extension) | Day 2: session and role-guard layer, order creation API and service, order dialog UI, input validation, Vitest suites, README updates |
| Claude Code (Claude Opus, VS Code extension) | Day 1: project scaffold, Drizzle schema, migration, seed script |

**Prompting Approach:**
The work was driven iteratively using the challenge brief. I provided one clear milestone per session (e.g., "Day 1: Scaffold and Database" and "Day 2: Auth and Orders"). Before accepting any AI-generated code, I manually reviewed the logic, specifically checking database constraints and error handling, and instructed the AI to fix any edge cases before moving forward.

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


## 3. Human Refactoring

While the AI handled the bulk of the coding and autonomous testing (such as running the PGlite tests that caught the NULL rejection-note bug), my role focused on architectural steering and project management to ensure the output met the strict evaluation criteria:

* **Milestone Planning & Phased Execution:** Instead of asking the AI to build the entire ERP at once, I structured the project into clear, manageable daily milestones (e.g., Day 1: Scaffold & DB, Day 2: Auth & Orders). This allowed me to review the logic and business rules incrementally before moving forward.
* **AI Oversight & Rule Enforcement:** When the AI autonomously found the rejection-note constraint issue, I reviewed its proposed fix (`coalesce`) to ensure it perfectly aligned with the strict gatekeeper business rules before accepting it. 
* **Workflow & UI/UX Polish:** I agreed with the AI's proposal for atomic commits to maintain a clean Git history. Furthermore, I directed the AI to fix the stale validation errors on the login form to ensure the user experience matched the accessible, immediate visual feedback requirements outlined in the brief.

## 4. Defensive Architecture

How the state machine and API guards prevent unauthorized status overrides, as
built so far.

**State machine**

- The legal transitions are defined once, in `src/lib/order-rules.ts`:
  `CUTTING_IN_PROGRESS → PENDING_VERIFICATION`,
  `PENDING_VERIFICATION → VERIFIED | REJECTED`,
  `REJECTED → PENDING_VERIFICATION`. `VERIFIED` has no exits.
- No endpoint accepts a status from the client. Each endpoint performs one
  named transition. `POST /api/orders` ignores `status`, `createdBy`,
  `orderNo` and item counts in the request body; a test sends all four and
  asserts they have no effect.
- The status check is part of the `UPDATE` statement itself
  (`WHERE id = ? AND status IN (...)`), not a read followed by a write, so two
  simultaneous requests cannot both move the same order. An illegal move
  returns `409`.

**API guards**

- Every route handler calls `requireRole(request, ...)` before doing anything
  else. No valid session returns `401`; the wrong role returns `403`.
- The user id and role come only from the session cookie: an `httpOnly` JWT
  signed with a server-side secret and verified with a fixed algorithm. A test
  confirms that a cookie with an edited role, an `alg: none` token and a
  garbage value are all treated as signed out.
- Page redirects and hidden buttons are treated as convenience only, never as
  the security boundary.

**Database constraints**

- Check constraints reject non-positive quantities and fabric yards
  regardless of what the application sends.
- A check constraint ties each stored traffic-light status to the stored
  counts, so a `GREEN` row with a shortage cannot exist.
- A partial unique index allows at most one `APPROVED` log per order, and a
  check constraint requires a non-blank note on every rejection.

**Input validation**

- One module (`src/lib/order-input.ts`) validates order input for both the
  browser form and the API, so the two cannot drift apart. The API accepts
  JSON numbers only: `"50"`, `12.5`, `-5`, `NaN` and empty payloads are
  rejected with `422` and per-field messages.

**TODO (Day 3–4):** the verifier hard stop (`422` when any component is RED,
missing or uncounted), the immutable audit log write on approval, and the
Sewing Queue query isolation (`WHERE status = 'VERIFIED'`).
