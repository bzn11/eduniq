# Eduniq

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

Eduniq is a student GPA tracker for terms, courses and weighted assignments. It calculates credit-weighted term and cumulative GPA, supports multiple institutional grading scales, and includes deterministic projections and what-if simulation so students can see standing and how remaining work maps to a target—without maintaining a spreadsheet.

---

## Features

### Authentication

- Email/password sign-up and sign-in via Supabase Auth
- Google OAuth
- Email verification gate before accessing the app
- Forgot-password and reset-password flows
- Client password rules (length, upper/lower, digit) enforced on sign-up
- Session refresh and route gating in Next.js middleware

### Onboarding

- Collects first name, school, and preferred grading scale
- Optional import of prior cumulative GPA + completed credits (synthetic history term)
- Optional full term/course import with grade percentages
- Redirects authenticated users who have not completed onboarding

### Academic dashboard

- Active-term overview with term GPA and cumulative GPA
- Add courses with credit weight and optional GPA/letter targets
- Term target GPA with status relative to current performance
- Heuristic term and CGPA projections (expected / best / worst)

### Course & assignment management

- Per-course assignments with weight and earned/total points
- Weighted course average with letter + GPA from the selected scale
- Course targets and “need on remaining work” guidance
- Full CRUD for terms, courses, and assignments

### Predictions & what-if

- Deterministic prediction engine (not ML): projected finals, required average on remaining weight, track status (`SAFE` / `AT_RISK` / `CRITICAL`), and heuristic target probability
- What-if simulation clones course assignments in memory only—simulation never writes to `CourseContext` or storage
- Simulated grade deltas vs current grade, plus recalculated term GPA and CGPA

### Academic history & coach

- Multi-term history with active-term switching, rename, and delete
- Prior academic history import for CGPA baselines before Eduniq
- Rule-based academic coach insights from prediction snapshots (status, focus areas, target guidance)

### Profile & grading scales

- Profile fields: name, school, grade scale
- Built-in scales: Standard 4.0 (UofT-style), OMSAS, 4.33, and percentage-only
- Scale changes re-enrich stored courses against the new bands

### Persistence

- Browser `localStorage` cache for fast hydration and offline continuity
- Supabase Postgres sync for authenticated users (`terms` → `courses` → `assignments`)
- Profiles stored in Supabase with row-level security

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Database | Supabase Postgres |
| Authentication | Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`) |
| Client cache | `localStorage` |
| State | React Context (`Auth`, `Profile`, `Course`) |
| Academic math | Pure TypeScript modules (`lib/grading`, `lib/courseMetrics`, `lib/predictionEngine`, `lib/whatIfEngine`) |
| Auth callback | Next.js Route Handler (`app/auth/callback`) |
| Hosting | Any Node host that runs `next start` (e.g. Vercel) |

No ORM, payments, third-party AI API, charting library, or file storage is used.

---

## Architecture

**Frontend** — App Router pages under `app/`, mostly client components for interactive academic UI. Shared chrome (`TopNav`, `AppShell`) wraps authenticated routes.

**Backend** — Thin server surface: middleware for session + redirects, and `/auth/callback` for OAuth / email PKCE exchange. Academic reads/writes go from the browser to Supabase with the anon key under RLS.

**Database** — Postgres tables for `profiles`, `terms`, `courses`, and `assignments`, with RLS policies scoped to `auth.uid()`.

**Authentication** — Supabase Auth cookies via `@supabase/ssr`. Middleware refreshes the session and enforces public / protected / onboarding paths. `AppShell` mirrors those checks on the client after hydration.

**API layer** — No custom REST domain API. Domain logic lives in `lib/`; Supabase client helpers under `lib/supabase/` handle fetch and persist.

**External services** — Supabase (Auth + Postgres). Google is an Auth provider configured in the Supabase project.

**Important design choice** — Grade math, predictions, and what-if simulation are pure functions. Persistence is a separate concern (`CourseContext` + `academic-storage` + `academic-write`). What-if runs on cloned courses so simulations cannot corrupt real data.

```text
Browser UI
  → Auth / Profile / Course Context
  → lib academic engines (grading, metrics, prediction, what-if)
  → localStorage cache
  → Supabase Auth + Postgres (RLS)
```

---

## Folder Structure

```text
app/                 # App Router pages (landing, auth, home, history, course, profile)
components/          # Shared UI (AppShell, TopNav, auth, academic forms)
context/             # AuthProvider, ProfileProvider, CourseProvider
lib/                 # Domain logic, grading math, Supabase helpers, auth utilities
public/              # Static assets
supabase/migrations/ # SQL schema, RLS policies
middleware.ts        # Session refresh and route protection
```

---

## Getting Started

### Prerequisites

- Node.js 20+ (recommended)
- npm (repo includes `package-lock.json`)
- A [Supabase](https://supabase.com/) project (Auth + Postgres)

### Installation

```bash
git clone <your-repo-url> eduniq
cd eduniq
npm install
```

### Database setup

Apply migrations in order from `supabase/migrations/`:

1. `001_initial_schema.sql`
2. `002_profiles.sql`
3. `003_academic_data.sql`

Enable Email and (optionally) Google providers in the Supabase Auth dashboard. Set the Auth redirect URL to include:

```text
http://localhost:3000/auth/callback
```

### Environment variables

Copy the example below into `.env.local` (see [Environment Variables](#environment-variables)).

### Running locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Supabase env vars the app still loads; auth is disabled and academic data stays in `localStorage` only.

### Production build

```bash
npm run build
npm start
```

---

## Environment Variables

Create `.env.local`:

```bash
# Supabase project URL
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co

# Supabase anon (public) key — safe for the browser; protect data with RLS
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...masked...
```

These are the only environment variables referenced in the codebase.

---

## Key Workflows

### Sign-up → dashboard

```text
Sign up (email or Google)
        ↓
Email verification (email path)
        ↓
/auth/callback exchanges code for session
        ↓
Onboarding (profile + optional import)
        ↓
Home dashboard (active term)
        ↓
Courses / assignments → metrics & predictions
        ↓
localStorage cache + Supabase persist (when authenticated)
```

### Course tracking → what-if

```text
Open /course/[id]
        ↓
Add weighted assignments and grades
        ↓
Prediction engine projects finals & target probability
        ↓
Optional what-if: clone assignments → simulate scores
        ↓
Compare simulated course / term / CGPA vs current
        ↓
Close simulation (real data unchanged)
```

### Password recovery

```text
/forgot-password → Supabase reset email
        ↓
/auth/callback?next=/reset-password
        ↓
/reset-password → update password
```

## Security

- **Authentication** — Supabase Auth sessions stored in cookies; middleware calls `getUser()` to refresh and validate.
- **Authorization** — Postgres RLS: users can only read/write their own `profiles`, `terms`, and nested `courses` / `assignments`.
- **Protected routes** — `/home`, `/history`, `/history/[termId]`, `/course/[id]`, `/profile`, and `/onboarding` require a verified session; incomplete onboarding is redirected to `/onboarding`.
- **Public routes** — `/`, `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/auth/callback`.
- **Validation** — Client-side checks for credits, targets, assignment weights, password strength, and grade-scale IDs before mutate/persist.
- **What-if isolation** — Simulation state is in-memory only and cannot write through context.

---

## Performance Considerations

- **Optimistic hydration** — Authenticated users see `localStorage` cache immediately, then reconcile with Supabase.
- **Client-side math** — GPA, projections, and coach insights are computed in the browser from pure functions (no round-trips for calculations).
- **Scoped server work** — Middleware and the auth callback are the main server paths; academic CRUD is client → Supabase.
- **Single active term** — Term helpers keep one active term to keep dashboard queries small and UI focused.

---

## Future Improvements

- Promote Supabase to the sole durable source of truth (migrations already describe cloud sync evolving from local-first)
- Multi-device conflict handling for concurrent term edits
- Export (CSV / PDF) of term and cumulative history
- Additional institutional grade-scale presets
- Visual charts for GPA trends across terms
- Advisor or parent read-only share links
- Progressive Web App / offline queue for writes
- Automated tests for grading and prediction engines

---

## Lessons Learned

- **Credit-weighted CGPA** must aggregate course GPA × credits across all terms, not average term GPAs—small formula mistakes look “fine” until import scenarios.
- **Local-first UX + cloud auth** needs an explicit hydration policy: show cache, then merge cloud, and preserve synthetic prior-history terms that may only exist locally.
- **Simulation as a separate data path** (clone → compute → discard) keeps what-if features safe without branching persistence logic.
- **Heuristic “probability” and coach copy** are transparency features: document them as rules over performance signals, not machine learning, so users trust the numbers they see.

---

## License

This repository is marked `"private": true` in `package.json` and does not include a license file. All rights reserved unless a license is added later.
