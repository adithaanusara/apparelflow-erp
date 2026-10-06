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

## Getting started

Requires Node.js 20.9 or later.

```bash
npm install
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

## Project structure

```
src/
  app/            Next.js App Router: pages, layouts, and API route handlers
    layout.tsx    Root layout and page metadata
    page.tsx      Landing page (placeholder)
    globals.css   Global styles (Tailwind entry point)
```
