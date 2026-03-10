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
- Placeholder dashboard pages and placeholder backend domain endpoints

What is still placeholder / not implemented yet:
- Protocol PDF upload and extraction pipeline
- Criteria editing persistence
- Patient CRUD and document ingestion workflows
- Simulation execution engine and reasoning trace generation
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
| `/protocols` | Protocol upload and criteria review placeholder | Placeholder UI |
| `/patients` | Patient screening placeholder table | Placeholder UI |
| `/simulation/[id]` | Simulation results placeholder | Placeholder UI |
| `/settings` | Clerk profile / settings placeholder | Implemented placeholder |

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
| `GET` | `/api/v1/patients` | Patient list placeholder | Yes | Placeholder `501` |
| `GET` | `/api/v1/patients/{patient_id}` | Patient detail placeholder | Yes | Placeholder `501` |
| `POST` | `/api/v1/patients/{patient_id}/documents` | Patient document upload placeholder | Yes | Placeholder `501` |
| `POST` | `/api/v1/patients/{patient_id}/confirm-enrichment` | Enrichment confirmation placeholder | Yes | Placeholder `501` |
| `POST` | `/api/v1/simulation/pre-screen` | Pre-screen placeholder | Yes | Placeholder `501` |
| `POST` | `/api/v1/simulation/full` | Full simulation placeholder | Yes | Placeholder `501` |
| `GET` | `/api/v1/simulation/{simulation_id}` | Simulation fetch placeholder | Yes | Placeholder `501` |

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
