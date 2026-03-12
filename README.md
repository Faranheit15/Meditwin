# MediTwin

Patient Digital Twin for Clinical Trial Eligibility Simulation

MediTwin is a hackathon project for clinical trial coordinators to upload protocol PDFs, translate eligibility text into structured clinical rules, pre-screen candidate patients, and eventually run forward-looking digital twin simulations with interpretable reasoning traces. The current implementation provides the core application foundation: authenticated dashboard shell, typed frontend API layer, FastAPI backend with Clerk JWT verification, Supabase PostgreSQL connectivity, startup seeding, structured logging, and placeholder routes/pages for the protocol, patient, and simulation workflows.

## Current status

This repository is in the platform-foundation stage.

What is implemented now:
- Next.js frontend with Clerk auth integration and protected dashboard routes
- FastAPI backend with versioned API routing under `/api/v1`
- Async SQLAlchemy connection layer using `asyncpg`
- Supabase PostgreSQL connectivity and startup table creation
- Clerk JWT verification via JWKS on the backend
- Local user auto-sync on authenticated backend access
- Typed frontend API client with Axios interceptors
- Storage abstraction via `UserSessionManager` and typed hooks
- Structured backend logging, exception handling, CORS, request IDs, and request timing
- Protocol upload, criteria review, confirmation, pre-screen, and simulation result workflows
- Deterministic digital twin, simulation runner, and pre-screen engines
- LLM-backed reasoning trace generation for borderline and failing evaluations

What is still placeholder / not implemented yet:
- Patient CRUD and document ingestion workflows
- Clerk webhook processing
- Production-grade file storage, audit history, and monitoring

## Architecture overview

```mermaid
flowchart LR
    U[Clinical Trial Coordinator] --> FE[Next.js Frontend]
    FE -->|Clerk session| CK[Clerk]
    FE -->|Bearer token + REST| BE[FastAPI Backend]
    BE -->|Verify JWT via JWKS| CK
    BE -->|Async SQLAlchemy + asyncpg| DB[(Supabase PostgreSQL)]
    BE -->|Future simulation / extraction calls| GR[Groq API\nplanned]
```

## Request flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Next.js Frontend
    participant Clerk as Clerk
    participant Backend as FastAPI Backend
    participant DB as Supabase PostgreSQL

    User->>Frontend: Open protected route
    Frontend->>Clerk: Resolve session / token
    Clerk-->>Frontend: JWT
    Frontend->>Backend: GET /api/v1/auth/me with Bearer token
    Backend->>Clerk: Fetch / refresh JWKS if needed
    Backend->>Backend: Verify JWT claims and signature
    Backend->>DB: Find or create local User
    DB-->>Backend: User row
    Backend-->>Frontend: APIResponse<User>
    Frontend-->>User: Render dashboard after session sync
```

## Service inventory

This repository is currently a modular monorepo, not a distributed microservice system. The service boundaries today are:

| Service | Type | Responsibility | Status |
|---|---|---|---|
| Frontend App | Internal app service | Dashboard UI, Clerk session handling, protected routing, typed API access | Implemented |
| Backend API | Internal app service | Auth verification, DB access, API routing, seeding, logging, request middleware | Implemented |
| Clerk | External managed auth service | Authentication UI, session issuance, JWT signing, JWKS | Integrated |
| Supabase PostgreSQL | External managed data service | Primary relational database | Integrated |
| Groq | External AI service | Future protocol extraction and simulation reasoning workloads | Planned / config only |

If you need to describe these as “microservices” in a presentation, the most accurate phrasing is:
- `Frontend web client`
- `Backend API service`
- `Managed auth service (Clerk)`
- `Managed database service (Supabase PostgreSQL)`
- `Planned AI inference service (Groq)`

## Tech stack

### Frontend
- Next.js `16.1.6`
- React `19`
- TypeScript
- Tailwind CSS `v4`
- shadcn/ui primitives
- Clerk for auth
- Axios for API access
- `bun` as package manager

### Backend
- FastAPI
- Python `3.14+`
- SQLAlchemy async
- `asyncpg`
- Pydantic Settings
- PyJWT + cryptography
- `uv` as Python package manager / runner

### Managed / external services
- Supabase PostgreSQL
- Clerk
- Groq API key support in config for future AI features

## Repository layout

```text
meditwin/
├── backend/
│   ├── .env.example
│   ├── pyproject.toml
│   ├── uv.lock
│   └── app/
│       ├── main.py
│       ├── api/
│       │   ├── router.py
│       │   └── v1/
│       │       ├── auth.py
│       │       ├── health.py
│       │       ├── patients.py
│       │       ├── protocols.py
│       │       └── simulation.py
│       ├── config/settings.py
│       ├── core/
│       │   ├── dependencies.py
│       │   ├── exceptions.py
│       │   ├── logging.py
│       │   └── middleware.py
│       ├── models/
│       │   ├── base.py
│       │   ├── patient.py
│       │   ├── protocol.py
│       │   ├── simulation.py
│       │   └── user.py
│       ├── schemas/
│       │   ├── common.py
│       │   ├── patient.py
│       │   ├── protocol.py
│       │   ├── simulation.py
│       │   └── user.py
│       ├── services/
│       │   ├── auth.py
│       │   ├── database.py
│       │   └── seeder.py
│       └── utils/helpers.py
├── frontend/
│   ├── .env.local.example
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── globals.css
│       │   ├── (auth)/
│       │   │   ├── sign-in/[[...sign-in]]/page.tsx
│       │   │   └── sign-up/[[...sign-up]]/page.tsx
│       │   └── (dashboard)/
│       │       ├── layout.tsx
│       │       ├── protocols/page.tsx
│       │       ├── patients/page.tsx
│       │       ├── settings/page.tsx
│       │       └── simulation/[id]/page.tsx
│       ├── proxy.ts
│       ├── components/
│       ├── constants/
│       ├── hooks/
│       ├── lib/
│       ├── stores/
│       └── types/
├── CLAUDE.md
└── README.md
```

## Frontend implementation details

### App shell
- Root layout wraps the app in `ClerkProvider`
- Dashboard routes are protected through `src/proxy.ts`
- The dashboard shell includes:
  - responsive sidebar
  - mobile drawer navigation
  - page header
  - class-based error boundary

### Auth flow
- Public routes:
  - `/`
  - `/sign-in`
  - `/sign-up`
- Protected routes:
  - `/protocols`
  - `/patients`
  - `/simulation`
  - `/simulation/[id]`
  - `/settings`
- After sign-in, the frontend redirects to `/protocols`
- `AuthGuard` calls backend `/api/v1/auth/me` to verify the Clerk token and sync the local user record

### Frontend route map

| Route | Purpose | Status |
|---|---|---|
| `/` | Landing page, redirects authenticated users to dashboard | Implemented |
| `/sign-in` | Clerk sign-in screen | Implemented |
| `/sign-up` | Clerk sign-up screen | Implemented |
| `/protocols` | Protocol upload and criteria review workflow | Implemented |
| `/patients` | Patient registry plus protocol-specific pre-screen ranking workflow | Implemented |
| `/simulation` | Simulation history listing with stats and result navigation | Implemented |
| `/simulation/[id]` | Simulation results timeline and reasoning view | Implemented |
| `/settings` | Workspace overview dashboard, activity feed, and system info | Implemented |

### Frontend data layer
- `src/lib/axios.ts`
  - central Axios instance
  - attaches Clerk bearer token
  - redirects on `401`
  - consistent typed error surface
- `src/lib/api.ts`
  - all API calls grouped by domain
  - explicit TypeScript return types
- `src/types/*`
  - shared frontend request / response / model contracts

### Frontend persistence rules
- Do not access `localStorage` directly in feature code
- Use:
  - `UserSessionManager`
  - `useLocalStorage`
  - `useSessionStorage`
  - `useCookieStorage`

## Backend implementation details

### Backend responsibilities
- FastAPI app bootstrap with lifespan startup and shutdown
- DB engine connection and disposal
- schema creation on startup
- request ID generation
- request timing logs
- CORS handling
- uniform error responses
- Clerk JWT verification and user sync

### API routing

All backend routes are mounted under:

```text
/api/v1
```

### Implemented endpoints

| Method | Path | Purpose | Auth | Status |
|---|---|---|---|---|
| `GET` | `/api/v1/health` | Health status, app version, DB connection flag | No | Implemented |
| `GET` | `/api/v1/auth/me` | Verify token and return synced local user | Yes | Implemented |
| `POST` | `/api/v1/auth/webhook` | Clerk webhook placeholder | No | Placeholder `501` |
| `POST` | `/api/v1/protocols/upload` | Protocol upload placeholder | Yes | Placeholder `501` |
| `GET` | `/api/v1/protocols/{protocol_id}/criteria` | Criteria fetch placeholder | Yes | Placeholder `501` |
| `PATCH` | `/api/v1/protocols/criteria/{criterion_id}` | Criterion update placeholder | Yes | Placeholder `501` |
| `GET` | `/api/v1/patients` | Patient list with latest labs and optional protocol ordering | Yes | Implemented |
| `GET` | `/api/v1/patients/{patient_id}` | Patient detail with labs, medications, and conditions | Yes | Implemented |
| `POST` | `/api/v1/patients/{patient_id}/documents` | Patient document upload placeholder | Yes | Placeholder `501` |
| `POST` | `/api/v1/patients/{patient_id}/confirm-enrichment` | Enrichment confirmation placeholder | Yes | Placeholder `501` |
| `POST` | `/api/v1/simulate/pre-screen` | Bulk pre-screen all patients against one confirmed protocol | Yes | Implemented |
| `POST` | `/api/v1/simulate/full` | Run and persist a full patient-protocol simulation | Yes | Implemented |
| `GET` | `/api/v1/simulations` | List stored simulations with joined patient/protocol summary fields | Yes | Implemented |
| `GET` | `/api/v1/simulations/{simulation_id}` | Fetch a stored simulation with evaluations and traces | Yes | Implemented |

### Domain models currently defined

| Model group | Entities |
|---|---|
| Identity | `User` |
| Protocols | `Protocol`, `Criterion` |
| Patients | `Patient`, `LabResult`, `Medication`, `Condition` |
| Simulations | `Simulation`, `Evaluation`, `ReasoningTrace` |

### Backend response envelope

Successful responses use:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Error responses use:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "..."
  }
}
```

### Logging and middleware

Implemented middleware and cross-cutting concerns:
- request ID middleware
- request logging middleware
- configurable CORS middleware
- custom exception handlers
- structured logger with timestamp, level, module/event, and extra fields

Example log shape:

```text
[2026-03-10 17:01:42] ✅ INFO  | main:startup_complete | Application ready | version=1.0.0
```

## Authentication design

```mermaid
flowchart TD
    A[User signs in with Clerk UI] --> B[Clerk issues session token]
    B --> C[Frontend obtains bearer token]
    C --> D[Backend dependency get_current_user]
    D --> E[ClerkAuthService verifies JWT against JWKS]
    E --> F[get_or_create_user in PostgreSQL]
    F --> G[Protected endpoint executes]
```

Key implementation points:
- Clerk runs only on the frontend for UI/session handling
- Backend never trusts the frontend user object directly
- Backend verifies the token signature using Clerk JWKS
- Backend creates or updates a local `User` record on authenticated access

## Database design

The backend supports two database configuration styles:

### Option A: single URL
```env
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/postgres
```

### Option B: split credentials
```env
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=
DB_NAME=
```

If `DATABASE_URL` is not present, the backend builds the async SQLAlchemy connection string from the `DB_*` values.

### Seeder behavior
- runs during FastAPI lifespan startup
- creates tables with `Base.metadata.create_all()`
- checks for existing seed state
- currently inserts no mock data

No Alembic is used in the current implementation.

### Tables in the Database:

- **`users`** — Every person who logs into the app. Created automatically on first sign-in via Clerk. The `clerk_id` links to Clerk's auth system, `role` determines what they can do (coordinator, admin, sponsor). This table is referenced by `patients.created_by_id`, `protocols.uploaded_by_id`, and `simulations.created_by_id` so you always know who did what. It's your audit trail anchor.

- **`protocols`** — One row per uploaded trial protocol document. When a coordinator uploads a PDF, this row gets created immediately with `status: "processing"` and the `raw_text` field stores the full extracted text from the PDF. Once the LLM finishes extracting criteria, `status` changes to `"extracted"` and `criteria_count` gets updated. After the coordinator reviews and confirms the criteria, status becomes `"confirmed"`. If extraction fails, it goes to `"failed"`. Think of this as the header record — it represents the trial itself.

- **`criteria`** — One row per individual eligibility rule extracted from a protocol. A single protocol might produce 15-25 criteria rows. Each row is a machine-readable rule: `parameter` is what to check (eGFR, hemoglobin, age), `operator` is how to check it (>=, <=, BOOLEAN, STABLE, NOT_WITHIN), `threshold` is the cutoff value, `unit` is the measurement unit, `time_window` is for temporal rules like "no exposure within 180 days", and `eval_schedule` is the list of trial weeks where this criterion needs to be checked (like [0, 4, 8, 12, 24]). The `confidence` score indicates how reliably the LLM extracted this rule, and `requires_review` flags subjective criteria that can't be automated. This is the table your simulation engine reads as input.

- **`patients`** — One row per patient/test subject in the system. Contains demographics and summary fields. The `pre_screen_score` and `risk_level` fields get populated by the pre-screen sweep — they represent the quick, no-projection assessment of how likely this patient is to qualify. These are the values shown in the patient ranking table before anyone runs a full simulation. `created_by_id` tracks which coordinator added this patient.

- **`lab_results`** — The patient's historical lab data over time. Multiple rows per patient, each timestamped with `result_date`. This is the most important table for your digital twin engine because this is where trends come from. If a patient has 5 eGFR readings spread over 6 months, your engine computes the slope from these rows and uses it to project forward. `reference_low` and `reference_high` store the normal range so you can flag abnormal values in the UI. When a coordinator uploads a new lab report and confirms the extraction, new rows get inserted here and the twin's projections update.

- **`medications`** — Current and historical medications for each patient. `start_date` and `end_date` (nullable, meaning still active if null) let you know what the patient is currently on and what they were on in the past. Your simulation engine uses this for BOOLEAN criteria like "no prior anti-CD20 therapy" and NOT_WITHIN criteria like "no immunosuppressant within 6 months." You check: is there a medication matching the criterion where `end_date` is null or within the time window?

- **`conditions`** — Diagnosed medical conditions for each patient, coded with ICD-10 codes. Used for inclusion criteria like "must have confirmed diagnosis of rheumatoid arthritis" (check if the patient has the relevant ICD code) and exclusion criteria like "no active malignancy" (check if any oncology-related ICD codes exist). The `onset_date` matters for temporal checks.

- **`simulations`** — One row per full simulation run. Links a specific protocol to a specific patient — "we ran Protocol B's criteria against Patient 7." The `overall_risk` (HIGH/MEDIUM/LOW), `risk_score` (0-1 normalized), and `compatibility_score` (0-100 percentage) are the headline numbers shown at the top of the simulation results page. `created_by_id` tracks who ran it. You can run multiple simulations for the same patient-protocol pair — for example, before and after enriching a patient's data with new documents.

- **`evaluations`** — The detailed results matrix. One row per criterion per timepoint per simulation. If a simulation checks 15 criteria across 6 timepoints, that's 90 evaluation rows. Each row records the `status` (PASS/BORDERLINE/FAIL), the `projected_value` at that week, the `threshold` it was checked against, the `margin_percent` (how far above or below the threshold), and the `confidence` of the projection. This is what powers the timeline grid visualization — each colored cell in that grid is one evaluation row.

- **`reasoning_traces`** — Natural language explanations attached to individual evaluations. Only generated for BORDERLINE and FAIL evaluations — PASS evaluations don't need explanations. Each trace contains the `explanation` (the 2-3 sentence plain language description), `risk_factors` (JSON array of contributing factors), `suggestion` (recommended action like "consider nephrology consult"), and `confidence_note` (like "based on 6 data points over 5 months"). This is what appears when a coordinator clicks on a yellow or red cell in the timeline grid.

So the data flow through the tables goes: **users** → creates **protocols** → extraction produces **criteria**. Separately, **users** → creates **patients** → enrichment adds **lab_results**, **medications**, **conditions**. Then the simulation engine reads **criteria** + **patient data** → writes to **simulations** + **evaluations** → reasoning engine writes **reasoning_traces** linked to evaluations.

## Local development setup

## 1. Prerequisites

- Node / Bun installed
- Python installed
- `uv` installed
- Supabase PostgreSQL credentials available
- Clerk project credentials available

## 2. Backend environment

Create `backend/.env` from `backend/.env.example`.

Recommended values for local development:

```env
APP_NAME=MediTwin
APP_VERSION=1.0.0
DEBUG=true
ENVIRONMENT=dev

DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=5432
DB_NAME=postgres

CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWKS_URL=

GROQ_API_KEY=

CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO
```

Notes:
- `CORS_ORIGINS` can be a single origin or comma-separated list
- do not keep multiline `CLERK_JWKS_PUBLIC_KEY` in the backend `.env`; it is not used and may break dotenv parsing

## 3. Frontend environment

Create `frontend/.env.local` from `frontend/.env.local.example`.

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

## 4. Install dependencies

### Backend
```powershell
cd backend
uv sync
```

### Frontend
```powershell
cd frontend
bun install
```

## 5. Run the app locally

### Start backend
```powershell
cd backend
uv run fastapi run app/main.py
```

If Windows PowerShell hits UTF-8 / emoji issues with `fastapi-cli`, run:

```powershell
$env:PYTHONUTF8=1
uv run fastapi run app/main.py
```

If port `8000` is already in use:

```powershell
uv run fastapi run app/main.py --port 8001
```

### Start frontend
```powershell
cd frontend
bun dev
```

If the backend runs on `8001`, update:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1
```

## 6. Open the app

- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8000/docs`
- Backend health: `http://localhost:8000/api/v1/health`

## Docker Compose local development

The repository now includes a root-level `compose.yaml` for running the frontend and backend together in Docker with live-reload-friendly settings and streamed container logs.

### Files added for Docker-based development

- `compose.yaml` - local orchestration for frontend and backend
- `backend/Dockerfile.dev` - backend development image for FastAPI auto-reload
- `frontend/Dockerfile.dev` - frontend development image for Next.js + Bun
- `.env.compose.example` - example environment values for Docker Compose

### Setup

1. Copy `.env.compose.example` to `.env` in the project root.
2. Fill in the database, Clerk, and Groq values you use locally.
3. Start the stack:

```powershell
docker compose up --build
```

### URLs

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/v1`
- Backend docs: `http://localhost:8000/docs`

### Logs

Both services log directly to the Compose output so you can debug from a single terminal.

```powershell
docker compose logs -f
docker compose logs -f meditwin-backend
docker compose logs -f meditwin-frontend
```

### Stop the stack

```powershell
docker compose down
```

### Notes

- The setup uses bind mounts so code edits on Windows, Linux, and macOS are reflected inside the containers.
- File watching is configured for Docker-hosted development, including polling-based reload behavior that works reliably across platforms.
- Frontend dependencies are stored in named Docker volumes so host `node_modules` differences do not leak into the container.

## Local run checklist

```mermaid
flowchart TD
    A[Fill backend .env] --> B[Fill frontend .env.local]
    B --> C[Run backend with uv]
    C --> D[Run frontend with bun]
    D --> E[Open localhost:3000]
    E --> F[Sign in with Clerk]
    F --> G[Frontend calls /api/v1/auth/me]
    G --> H[User lands on /protocols]
```

## Useful commands

### Backend
```powershell
cd backend
uv run fastapi run app/main.py
uv run python -m compileall app
```

### Frontend
```powershell
cd frontend
bun dev
bun run lint
bun run build
```

## Railway deployment

The backend now includes Railway deployment files inside `backend/`:

- `backend/Dockerfile`
- `backend/.dockerignore`
- `backend/railway.toml`

This setup uses a Docker-based Railway deploy instead of Railpack auto-detection so the `uv` install and `uvicorn` runtime stay explicit.

### Railway flow

```mermaid
flowchart LR
    GH[GitHub Repository] --> RW[Railway Backend Service]
    RW -->|build backend/Dockerfile| CT[Backend Container]
    CT -->|serve FastAPI on 0.0.0.0:$PORT| API[FastAPI API]
    API --> DB[(Supabase PostgreSQL)]
    API --> CK[Clerk JWKS]
    FE[Vercel Frontend] --> API
```

### Railway setup

1. Push this repository to GitHub.
2. Create a new Railway project from the repo.
3. Add a backend service and set its Root Directory to `/backend`.
4. If Railway does not automatically detect the config file, set the Config as Code path to `/backend/railway.toml`.
5. Generate a public Railway domain for the backend service.
6. Add the backend environment variables listed below.
7. Deploy and verify `GET /api/v1/health`.

### Railway backend environment

```env
APP_NAME=MediTwin
APP_VERSION=1.0.0
DEBUG=false
ENVIRONMENT=prod

# Use either DATABASE_URL or the split DB fields
DATABASE_URL=
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=5432
DB_NAME=postgres

CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWKS_URL=

GROQ_API_KEY=

CORS_ORIGINS=https://your-frontend-domain.com
LOG_LEVEL=INFO
```

### After Railway is live

Update the frontend deployment environment with the Railway backend URL:

```env
NEXT_PUBLIC_API_URL=https://your-railway-domain.up.railway.app/api/v1
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

### Railway deploy checklist

```mermaid
flowchart TD
    A[Push repo to GitHub] --> B[Create Railway service]
    B --> C[Set Root Directory to /backend]
    C --> D[Load backend/railway.toml]
    D --> E[Add Railway env vars]
    E --> F[Generate backend domain]
    F --> G[Point NEXT_PUBLIC_API_URL to Railway]
    G --> H[Set CORS_ORIGINS to frontend domain]
    H --> I[Deploy and hit /api/v1/health]
```

### Production notes

- Keep `DEBUG=false` on Railway.
- Use `LOG_LEVEL=INFO` unless you are actively debugging production.
- Do not include the unused multiline `CLERK_JWKS_PUBLIC_KEY` in backend env vars.
- Keep `CORS_ORIGINS` aligned with your deployed frontend domain or a comma-separated list of allowed domains.
- The FastAPI startup seeder still runs on Railway boot and will create tables if they do not exist.

## Known implementation notes

- The frontend dashboard pages are intentionally placeholder-heavy right now
- The backend connects successfully to Supabase and creates / verifies tables on startup
- The authenticated frontend flow depends on Clerk plus backend `/auth/me` sync
- Next.js route protection uses `src/proxy.ts`, not `middleware.ts`, because the repo uses `src/`
- The frontend landing page now redirects signed-in users to `/protocols`

## Troubleshooting

### Backend starts and then exits with port error

You already have something bound to `8000`.

Run:

```powershell
netstat -ano | findstr :8000
Get-Process -Id <PID>
Stop-Process -Id <PID> -Force
```

Or start the backend on another port:

```powershell
uv run fastapi run app/main.py --port 8001
```

### `CORS_ORIGINS` parsing error

Use:

```env
CORS_ORIGINS=http://localhost:3000
```

Do not wrap it in invalid JSON unless you intend to provide a JSON array.

### Clerk says middleware / proxy was not run

Ensure the file is exactly:

```text
frontend/src/proxy.ts
```

### Sign-in returns to `/`

The app now redirects authenticated users to `/protocols`. If this ever regresses:
- verify Clerk env vars
- verify frontend can reach backend `/api/v1/auth/me`
- verify `NEXT_PUBLIC_API_URL`

## Key files to know

### Backend
- `backend/app/main.py` - FastAPI app bootstrap and lifespan
- `backend/app/config/settings.py` - env parsing and DB fallback logic
- `backend/app/services/database.py` - async engine and session singleton
- `backend/app/services/auth.py` - Clerk JWT verification and local user sync
- `backend/app/core/logging.py` - structured logger configuration
- `backend/Dockerfile` - production backend container definition for Railway
- `backend/railway.toml` - Railway build and deploy configuration

### Frontend
- `frontend/src/app/layout.tsx` - root app shell
- `frontend/src/proxy.ts` - Clerk route protection
- `frontend/src/components/auth/AuthGuard.tsx` - session sync gate for dashboard routes
- `frontend/src/lib/axios.ts` - central Axios client and auth interceptors
- `frontend/src/lib/api.ts` - typed API calls
- `frontend/src/stores/UserSessionManager.ts` - browser persistence abstraction

## Verification completed on current implementation

These checks were run against the current codebase:
- backend Python compile verification
- frontend ESLint
- frontend production build
- backend startup smoke test
- frontend dev startup smoke test

## Roadmap from here

Suggested next implementation milestones:
1. protocol upload endpoint + file storage + extraction job boundary
2. criteria CRUD with persisted review states
3. patient ingestion and enrichment confirmation flow
4. simulation execution service with timeline persistence
5. reasoning trace generation and UI rendering
6. production monitoring and audit logging

## License / hackathon note

This repository is structured as a hackathon foundation and is optimized for rapid extension. It is not yet production hardened for PHI handling, clinical validation, or regulated deployment.

## Recent implementation update

The protocol workflow is no longer placeholder-only. The backend now includes:
- `GroqLLMService` in `backend/app/services/llm.py` for Groq chat completions with retries, timing logs, and rate-limit handling
- `PDFParserService` in `backend/app/services/pdf_parser.py` for protocol PDF text extraction and section splitting
- `CriteriaExtractorService` in `backend/app/services/extractor.py` for the end-to-end PDF -> prompt -> JSON -> validated criterion pipeline
- prompt definitions in `backend/app/core/prompts.py`
- protocol and criterion APIs backed by the database instead of `501` placeholders

### Protocol routes now implemented

| Method | Path | Purpose | Auth | Status |
|---|---|---|---|---|
| `POST` | `/api/v1/protocols/upload` | Upload a protocol PDF and run criteria extraction | Yes | Implemented |
| `GET` | `/api/v1/protocols` | List uploaded protocols | Yes | Implemented |
| `GET` | `/api/v1/protocols/{protocol_id}` | Fetch a protocol with its extracted criteria | Yes | Implemented |
| `GET` | `/api/v1/protocols/{protocol_id}/criteria` | Fetch criteria for a protocol | Yes | Implemented |
| `PATCH` | `/api/v1/criteria/{criterion_id}` | Manually edit one extracted criterion | Yes | Implemented |
| `POST` | `/api/v1/protocols/{protocol_id}/confirm` | Confirm reviewed criteria and mark the protocol ready for screening | Yes | Implemented |

### Auth sync update

The Clerk auth sync now reads custom JWT claims for:
- `email`
- `first_name`
- `last_name`

On each authenticated request, the backend now updates the local `users` row with the latest Clerk email, names, and `last_login_at` instead of keeping the old fallback `@clerk.local` address when the claims are present.

### Environment variables

Backend local and deployed environments now require:

```env
GROQ_API_KEY=
```

This is used by the protocol extraction pipeline in `GroqLLMService`.

### Verification commands used for this implementation

Backend:
```powershell
cd backend
uv sync
$env:UV_CACHE_DIR=(Resolve-Path '.uv-cache').Path
uv run python -m compileall app
uv run python -c "from app.main import app; print(app.title)"
```

Frontend:
```powershell
cd frontend
bun run lint
bun run build
```

Verification notes:
- `bun run lint` passed.
- backend compile verification passed.
- backend import smoke test passed by importing `app.main` successfully.
- `bun run build` compiled successfully and completed TypeScript, but the process ended with a sandbox `spawn EPERM` after that compilation step.
- live Clerk sign-in, Supabase row verification, Groq extraction against real PDFs, and curl endpoint checks still require a local runtime with valid `.env` credentials.

## Day 3 simulation implementation

The patient screening and simulation pipeline is now implemented in the backend and wired into the dashboard patients page.

### New backend modules

- `backend/app/core/twin.py` - Digital Twin engine for lab trend fitting and forward projection
- `backend/app/core/simulator.py` - Deterministic rule engine for criterion-by-week evaluation and risk scoring
- `backend/app/core/pre_screener.py` - Fast bulk pre-screener using current values only
- `backend/app/utils/clinical_mappings.py` - Shared ICD and medication matching utilities used by the twin and pre-screener
- `backend/app/schemas/simulation.py` - Request and response schemas for pre-screen and full simulation APIs

### New API endpoints

- `POST /api/v1/simulate/pre-screen` - Load a confirmed protocol, score every patient, update `patients.pre_screen_score` and `patients.risk_level`, and return ranked results
- `POST /api/v1/simulate/full` - Build a digital twin for one patient, evaluate the full timeline, persist `simulations` and `evaluations`, and return the stored result
- `GET /api/v1/simulations/{id}` - Return a stored simulation with criterion metadata and any reasoning traces already attached

### Architecture notes

- The Digital Twin and Simulation Runner are pure Python and deterministic. No LLM calls are involved in projection or rule evaluation.
- Pre-screen uses current values only, skips `STABLE` checks, and is optimized for fast cohort ranking.
- Full simulation computes linear regression trends with `numpy`, projects values forward by week, and evaluates each scheduled criterion timepoint.
- Condition matching uses ICD-10 prefix and keyword matching through `CONDITION_MAP`.
- Medication matching uses shared `MEDICATION_MAP` name matching and date window overlap logic.

### Key design decisions

- `BORDERLINE_MARGIN = 0.20` defines the 20% threshold proximity zone for numeric criteria.
- Projection confidence uses `r_squared * (1 / (1 + 0.02 * weeks))`.
- Risk score is the normalized weighted sum of `FAIL = 1.0`, `BORDERLINE = 0.4`, and `PASS = 0.0`.
- Overall risk classification is `HIGH > 0.6`, `MEDIUM > 0.3`, `LOW <= 0.3`.

### Frontend wiring

- `frontend/src/app/(dashboard)/patients/page.tsx` now reads `protocol_id` from the query string, runs pre-screen automatically, renders ranked patient results, supports expandable detail panels, and triggers `Run Simulation`.
- `frontend/src/lib/api.ts` now targets `/simulate/pre-screen`, `/simulate/full`, and `/simulations/{id}` with 60-second request timeouts on the simulation actions.
- `frontend/src/types/models.ts` and `frontend/src/types/api.ts` now include the pre-screen and full simulation response contracts used by the dashboard.

### Validation commands

Backend:

```powershell
cd backend
uv sync
$env:UV_CACHE_DIR=(Resolve-Path '.uv-cache').Path
uv run python -m compileall app
uv run python -c "from app.main import app; print(app.title)"
uv run fastapi dev app/main.py
```

Frontend:

```powershell
cd frontend
bun run lint
bunx tsc --noEmit
bun dev
```

### Runtime checks for seeded demo data

- `POST /api/v1/simulate/pre-screen` should return all 10 seeded patients ranked by `preScreenScore`
- Robert Chen, Aisha Patel, and Carlos Rivera should land in the strongest cohort bucket with low risk
- Margaret O'Brien should screen as medium risk and remain a good demo patient for a borderline full simulation
- William Hartley and Luis Gutierrez should surface immediate fail reasons during pre-screen
- Margaret O'Brien full simulation should show eGFR moving from pass into borderline and then fail around weeks 12-16
- William Hartley full simulation should fail eGFR at week 0

## Day 4 reasoning and results page implementation

The full simulation flow now includes LLM-generated reasoning traces and the simulation results page is fully wired.

### New backend modules

- `backend/app/services/reasoner.py` - Batches BORDERLINE and FAIL evaluations into one reasoning-generation call and fills any missing traces with deterministic fallbacks
- `backend/app/core/prompts.py` - Includes reasoning trace system and user prompts used by the reasoner

### Updated API behavior

- `POST /api/v1/simulate/full` now persists the simulation first, then generates reasoning traces and stores them in `reasoning_traces`
- `GET /api/v1/simulations/{id}` now returns each evaluation with a nested `reasoning` object when a trace exists
- Reasoning generation is non-blocking relative to simulation persistence: if the LLM call fails, the simulation and evaluations still remain saved

### Frontend page completed

- `frontend/src/app/(dashboard)/simulation/[id]/page.tsx` now loads the simulation, patient, and protocol context; renders the summary header, timeline grid, coordinator-facing reasoning cards, and responsive mobile week cards
- The patients page simulation action now shows the longer-running status text while reasoning traces are generated
- Simulation API calls now use a 90-second timeout for full runs and result retrieval
- The simulation results page now includes Recharts-based parameter projection cards for multi-week numeric parameters such as eGFR and HbA1c
- Protocol, patient, timeline, reasoning, and chart surfaces now expose production-style export menus for CSV, JSON, and PNG downloads where image export is supported

### Architecture notes

- Reasoning generation is the only LLM call in the simulation pipeline
- The Digital Twin, Simulation Runner, and Pre-Screener remain pure computation
- Deterministic fallback traces are used when the LLM omits a flagged evaluation from its batch response
- Reasoning traces are stored in `reasoning_traces` and linked to `evaluations.evaluation_id`

### LLM usage summary

- Criteria extraction: typically 1-2 Groq calls per protocol upload, depending on prompt retry needs
- Reasoning traces: 1 Groq call per simulation run, batching all flagged evaluations together
- Pre-screen and deterministic simulation math: 0 LLM calls

### Day 4 validation commands

Backend:

```powershell
cd backend
$env:UV_CACHE_DIR=(Resolve-Path '.uv-cache').Path
uv run python -m compileall app
uv run python -c "from app.main import app; print(app.title)"
uv run fastapi dev app/main.py
```

Frontend:

```powershell
cd frontend
bun run lint
bunx tsc --noEmit
bun dev
```

### Expected reasoning behavior

- Margaret O'Brien should surface coordinator-readable eGFR reasoning that references the decline from 48.0 toward the mid-40s and the 45 threshold breach window
- Robert Chen should have few traces because most evaluations remain PASS
- William Hartley should produce immediate week-0 fail reasoning for the breached eGFR criterion

## Day 5 visualization refinement

The simulation results page now includes compact parameter trend charts using Recharts.

### Trend chart behavior

- Multi-week numeric parameters are rendered as small line charts on the simulation results page
- Projected values are shown as a cyan line, with dot colors reflecting PASS, BORDERLINE, and FAIL states
- Protocol thresholds are shown as dashed red reference lines so the crossing point is visually obvious
- Chart cards are responsive and stack into a single column on smaller screens

## Day 6 export controls

The frontend now includes reusable data export controls across tables and visualizations.

### Export behavior

- Table and visualization sections expose a shared download menu with CSV and JSON export
- PNG export is available for sections rendered in the browser, including the protocol list table, criteria review table, patient screening table, simulation timeline, reasoning panel, and parameter charts
- Exported files use page-specific filenames so coordinators can keep artifacts organized during review and demo workflows

## Day 7 dashboard workflow refinement

The coordinator-facing placeholder pages now expose real workspace value instead of dead ends.

### New and updated dashboard pages

- `frontend/src/app/(dashboard)/simulation/page.tsx` now renders a Simulation History view backed by `GET /api/v1/simulations`, including summary cards, responsive history tables, and direct navigation into stored results
- `frontend/src/app/(dashboard)/patients/page.tsx` now supports two modes: protocol-driven pre-screening when `protocol_id` is present and a full patient registry with search, expandable clinical details, and per-patient simulation actions when it is absent
- `frontend/src/app/(dashboard)/settings/page.tsx` now acts as a workspace overview dashboard with activity summary cards, recent protocol/simulation activity, quick actions, and condensed system information

### New backend support

- `GET /api/v1/simulations` now returns simulation list rows with patient and protocol names, compatibility/risk metrics, evaluation counts, flagged counts, and creation timestamps ordered newest first

### Navigation update

- Sidebar and mobile navigation now point to `/simulation` instead of the old `/simulation/latest` route, and `/simulation/latest` redirects to the history index for backward compatibility
