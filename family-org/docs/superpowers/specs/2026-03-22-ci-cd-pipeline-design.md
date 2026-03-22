# CI/CD Pipeline with QA, Security Scanning & Auto-Deploy

**Date:** 2026-03-22
**Status:** Approved

## Overview

Set up a GitHub Actions CI/CD pipeline that runs QA and security checks on every PR and push to `main`. When changes are merged to `main` and all checks pass, production Docker images are built, pushed to GHCR, and automatically deployed to a self-hosted server at `192.168.5.71`.

## Architecture

### Pipeline Flow

```
PR to main:     [lint] ──┐
                [security] ──├── All pass? ── PR checks green (no build/push)
                [test] ──┘

Push to main:   [lint] ──┐
                [security] ──├── All pass? ── [build & push images] ── [deploy to 192.168.5.71]
                [test] ──┘
```

### Key Decisions

- **Single workflow file:** `.github/workflows/ci-deploy.yml`
- **Parallel check jobs** for fast feedback (lint, security, test run concurrently)
- **Self-hosted runner** on `192.168.5.71` — free, unlimited minutes, runner IS the deploy target
- **GHCR** for container registry (free with GitHub, no extra config)
- **Push to main = auto deploy** (no manual approval gate)
- **Docker Compose with production overrides** for deployment

## Check Jobs

### Lint Job

**Frontend (ESLint):**
- Uses existing `frontend/eslint.config.js`
- Runs `npm ci && npm run lint` in `frontend/`

**Backend (Ruff):**
- Add `ruff` to a new `backend/requirements-dev.txt` (keeps dev tools separate from production deps)
- Add `backend/ruff.toml` with config: line length 120, standard rules
- Runs `ruff check .` and `ruff format --check .` in `backend/`

### Security Job

**Semgrep (SAST):**
- Scans both frontend and backend for security anti-patterns (SQL injection, XSS, auth issues, hardcoded secrets)
- Uses free rulesets: `p/default`, `p/python`, `p/typescript`
- Runs via official `semgrep/semgrep` Docker image

**Dependency scanning:**
- Frontend: `npm audit --audit-level=high` — fails on high/critical vulnerabilities
- Backend: `pip-audit` against `requirements.txt` — flags known CVEs (installed via `pip install pip-audit` in the CI step)

**Dependabot (configured separately):**
- Add `.github/dependabot.yml` for automatic vulnerability PRs
- Covers both `pip` (backend) and `npm` (frontend)

### Test Job

- Spins up the full stack using `docker compose` on the runner
- Runs existing `tests/test_e2e.py` against the running stack
- Tears down the stack after tests complete
- Uses `.env.test` with test-specific config:
  - Different port mappings to avoid conflicts with production (e.g., backend: 8091, frontend: 5181, postgres: 5441, rabbitmq: 5681)
  - Test-specific database name
  - No Cloudflare tunnel service
- Parameterise `test_e2e.py` to read `BASE_URL` / `API_URL` from environment variables instead of hardcoded localhost URLs

## Production Docker Images

### Backend (`backend/Dockerfile.prod` — new)

New production Dockerfile (mirrors the project pattern of separate dev/prod Dockerfiles, like `frontend/Dockerfile.dev`):
- Based on existing `backend/Dockerfile` but without `--reload` flag
- Add a non-root user for security
- Set `PYTHONDONTWRITEBYTECODE=1` and `PYTHONUNBUFFERED=1`
- Same image serves both the API and the worker (different CMD at compose level)
- Existing `backend/Dockerfile` remains unchanged for local development

### Frontend (`frontend/Dockerfile` — new)

Multi-stage build:
1. **Stage 1 (build):** `node:20-alpine` — copies `package.json` + `package-lock.json`, runs `npm ci && npm run build`, accepts `VITE_API_URL` as build arg (value: the production `PUBLIC_URL`)
2. **Stage 2 (serve):** `nginx:alpine` — copies built assets, adds `nginx.conf` for SPA routing (all routes to `index.html`)

### Docker Compose Production Override (`docker-compose.prod.yml` — new)

Overrides `docker-compose.yml` with:
- GHCR image references instead of local builds (`ghcr.io/<owner>/family-org-backend:latest`, `ghcr.io/<owner>/family-org-frontend:latest`)
- No dev volume mounts (no source code mounting)
- Restart policies (`unless-stopped`) for all services
- Internal-only port exposure for db and rabbitmq (no host mapping)
- RabbitMQ credentials via environment variables (replace default guest/guest)
- Worker uses same backend image with command override
- Cloudflare tunnel service remains unchanged

**Deploy command:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Build & Push Job

- **Only runs on push to `main`** (skipped on PRs — PRs only run check jobs)
- Runs after all three check jobs pass
- Logs into GHCR using `GITHUB_TOKEN` (automatic, no extra secrets needed)
- Builds backend and frontend production images using `Dockerfile.prod` and `Dockerfile` respectively
- Tags: `ghcr.io/<owner>/family-org-backend:<sha>` + `:latest` (same for frontend)
- Uses Docker layer caching to speed up subsequent builds

## Deploy Job

- Only runs on `push` to `main` (skipped on PRs)
- Runs on the self-hosted runner (which IS the production server)
- Steps:
  1. Pull latest images from GHCR
  2. Copy `docker-compose.yml` + `docker-compose.prod.yml` to `/opt/family-org/`
  3. Run `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
  4. Health check: curl backend `/health` and frontend endpoints
  5. If health check fails, roll back to previous image tags

### Rollback

- Before deploying, the deploy job records the current running image SHA to `/opt/family-org/.last-good-sha`
- Each image tagged with commit SHA enables manual rollback to any previous version
- Automatic rollback on health check failure:
  1. Read previous SHA from `.last-good-sha`
  2. Re-tag previous images as `:latest` and redeploy
  3. If no previous SHA exists (first deploy), just report the failure
- Previous images retained on the server (periodic `docker image prune --filter "until=720h"` to clean up images older than 30 days)
- **Note:** Rollback does not revert database migrations — see Database Migrations section

## Database Migrations

- The project uses SQLAlchemy. If Alembic is not yet configured, add it as part of this work.
- Migrations run as a deploy step **before** the new application containers start:
  1. Pull new backend image
  2. Run `docker compose run --rm backend alembic upgrade head`
  3. If migration fails, abort deploy (do not start new containers)
  4. If migration succeeds, proceed with `docker compose up -d`
- Migrations should be forward-only in production. If a rollback is needed, write a new migration to reverse the changes rather than running `alembic downgrade`.

## Concurrency & Branch Protection

**Deployment concurrency:**
- Add a GitHub Actions `concurrency` group (`deploy-production`) to the workflow
- Ensures only one deploy runs at a time — subsequent pushes cancel the in-progress deploy's build/deploy jobs (check jobs still run)

**Branch protection (configure in GitHub settings):**
- Require PR reviews before merging to `main`
- Require status checks to pass (lint, security, test) before merging
- No direct pushes to `main`

## Secrets & Environment

- Production `.env` lives on the server at `/opt/family-org/.env` — never in the repo
- CI only needs `GITHUB_TOKEN` (automatic) for GHCR access
- No GitHub Actions secrets needed for deployment (runner IS the server)

## Self-Hosted Runner Setup

- Install GitHub Actions runner on `192.168.5.71` as a systemd service
- Runs under a dedicated `github-runner` user with Docker group membership
- Labels: `self-hosted, linux, x64`
- Runner polls GitHub outbound — no inbound firewall rules needed
- Prerequisites: Docker, Docker Compose, Git, Node 20, Python 3.11

## Dependabot Configuration

`.github/dependabot.yml`:
- npm ecosystem for `frontend/` — weekly checks
- pip ecosystem for `backend/` — weekly checks

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/ci-deploy.yml` | Create | Main CI/CD pipeline |
| `.github/dependabot.yml` | Create | Dependency vulnerability PRs |
| `frontend/Dockerfile` | Create | Production frontend image (multi-stage) |
| `frontend/nginx.conf` | Create | SPA routing config for nginx |
| `backend/Dockerfile.prod` | Create | Production backend image (no --reload, non-root user) |
| `backend/ruff.toml` | Create | Python linting configuration |
| `backend/requirements-dev.txt` | Create | Dev/CI dependencies (ruff, pip-audit) |
| `docker-compose.prod.yml` | Create | Production compose overrides |
| `docker-compose.test.yml` | Create | Test compose overrides (non-conflicting ports) |
| `.env.test` | Create | Test environment config |
| `tests/test_e2e.py` | Modify | Parameterise URLs via env vars |
| `sample.env` | Modify | Document new env vars (RabbitMQ creds, etc.) |
