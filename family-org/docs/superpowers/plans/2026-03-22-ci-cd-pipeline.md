# CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a GitHub Actions CI/CD pipeline with parallel lint/security/test checks, GHCR image builds, and auto-deploy to a self-hosted runner on 192.168.5.71.

**Architecture:** Single workflow with parallel check jobs (lint, security, test) gating a build-and-push job that publishes production Docker images to GHCR. On push to main, a deploy job pulls those images on the self-hosted runner (which IS the production server) and restarts the stack via docker-compose with production overrides.

**Tech Stack:** GitHub Actions, Docker, Docker Compose, GHCR, ESLint, Ruff, Semgrep, pip-audit, nginx, Alembic

**Spec:** `docs/superpowers/specs/2026-03-22-ci-cd-pipeline-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/Dockerfile.prod` | Create | Production backend image (no --reload, non-root user) |
| `backend/ruff.toml` | Create | Ruff linter configuration |
| `backend/requirements-dev.txt` | Create | Dev/CI Python dependencies (ruff, pip-audit) |
| `frontend/Dockerfile` | Create | Production frontend multi-stage build (node build + nginx serve) |
| `frontend/nginx.conf` | Create | nginx SPA routing config |
| `docker-compose.prod.yml` | Create | Production compose overrides (GHCR images, no dev volumes, restart policies) |
| `docker-compose.test.yml` | Create | Test compose overrides (non-conflicting ports, no tunnel) |
| `.env.test` | Create | Test environment variables |
| `tests/test_e2e.py` | Modify | Parameterise URLs via env vars |
| `backend/alembic.ini` | Create | Alembic configuration |
| `backend/alembic/` | Create | Alembic migrations directory and env.py |
| `.github/workflows/ci-deploy.yml` | Create | Main CI/CD workflow |
| `.github/dependabot.yml` | Create | Dependency vulnerability auto-PRs |
| `sample.env` | Modify | Document new env vars |

---

## Task 1: Backend Linting Setup (Ruff)

**Files:**
- Create: `backend/ruff.toml`
- Create: `backend/requirements-dev.txt`

- [ ] **Step 1: Create ruff.toml**

```toml
# backend/ruff.toml
line-length = 120
target-version = "py311"

[lint]
select = ["E", "F", "W", "I", "S", "B", "A", "C4", "UP"]
ignore = ["S101"]  # allow assert in tests

[format]
quote-style = "double"
```

Rules: E/F/W = pycodestyle+pyflakes, I = isort, S = bandit security, B = bugbear, A = builtins, C4 = comprehensions, UP = pyupgrade.

- [ ] **Step 2: Create requirements-dev.txt**

```text
# backend/requirements-dev.txt
ruff>=0.8.0
pip-audit>=2.7.0
```

- [ ] **Step 3: Verify ruff runs locally**

Run: `cd /home/brian/git/family-org/family-org/backend && pip install ruff && ruff check . && ruff format --check .`

Expected: Output showing any lint issues (or clean). Fix any blocking errors before proceeding — ruff must be able to run without crashing.

- [ ] **Step 4: Commit**

```bash
git add backend/ruff.toml backend/requirements-dev.txt
git commit -m "chore: add ruff linting config and dev dependencies"
```

---

## Task 2: Production Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile.prod`
- Reference: `backend/Dockerfile` (unchanged)

- [ ] **Step 1: Create Dockerfile.prod**

```dockerfile
# backend/Dockerfile.prod
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies for Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install chromium

COPY . .

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Key differences from dev Dockerfile: no `--reload`, non-root user, Python env vars set.

- [ ] **Step 2: Verify it builds**

Run: `cd /home/brian/git/family-org/family-org && docker build -f backend/Dockerfile.prod -t family-org-backend:test backend/`

Expected: Successful build. The image should start without errors:
Run: `docker run --rm family-org-backend:test uvicorn app.main:app --host 0.0.0.0 --port 8000 &` (will fail to connect to DB, but should show uvicorn starting)

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile.prod
git commit -m "feat: add production backend Dockerfile"
```

---

## Task 3: Production Frontend Dockerfile & nginx Config

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: Create nginx.conf**

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

- [ ] **Step 2: Create production Dockerfile**

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: Verify it builds**

Run: `cd /home/brian/git/family-org/family-org && docker build --build-arg VITE_API_URL=http://localhost:8090/api -t family-org-frontend:test frontend/`

Expected: Successful multi-stage build. Test it serves:
Run: `docker run --rm -p 8888:80 family-org-frontend:test &` then `curl -s http://localhost:8888/ | head -5` — should return HTML.

Clean up: `docker stop $(docker ps -q --filter ancestor=family-org-frontend:test)`

- [ ] **Step 4: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf
git commit -m "feat: add production frontend Dockerfile with nginx"
```

---

## Task 4: Alembic Database Migrations Setup

**Files:**
- Modify: `backend/requirements.txt` (add alembic)
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/` (directory)

- [ ] **Step 1: Add alembic to requirements.txt**

Add `alembic` to `backend/requirements.txt`:

```text
alembic
```

- [ ] **Step 2: Initialize Alembic in the backend directory**

Run: `cd /home/brian/git/family-org/family-org/backend && pip install alembic && alembic init alembic`

Expected: Creates `alembic.ini` and `alembic/` directory with `env.py`, `script.py.mako`, and `versions/`.

- [ ] **Step 3: Configure alembic env.py to use the app's database URL and models**

Edit `backend/alembic/env.py` to import the app's SQLAlchemy Base and read `DATABASE_URL` from the environment:

```python
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Import the app's Base metadata for autogenerate support
from app.database import Base

config = context.config

# Override sqlalchemy.url with the environment variable
config.set_main_option("sqlalchemy.url", os.environ.get("DATABASE_URL", ""))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Note: Verify the import path `from app.database import Base` matches the actual location of the SQLAlchemy Base in the project. Check `backend/app/database.py` or similar.

- [ ] **Step 4: Generate an initial migration from current models**

Run: `cd /home/brian/git/family-org/family-org/backend && DATABASE_URL=postgresql://user:password@localhost:5440/family_org alembic revision --autogenerate -m "initial schema"`

Expected: Creates a migration file in `alembic/versions/`. Review it to ensure it captures the current schema.

- [ ] **Step 5: Verify migration runs**

Run: `cd /home/brian/git/family-org/family-org/backend && DATABASE_URL=postgresql://user:password@localhost:5440/family_org alembic upgrade head`

Expected: Migration applies successfully (or reports "already at head" if the schema already matches).

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/alembic.ini backend/alembic/
git commit -m "feat: add Alembic database migration support"
```

---

## Task 5: Docker Compose Production Override

**Files:**
- Create: `docker-compose.prod.yml`
- Modify: `sample.env`

- [ ] **Step 1: Create docker-compose.prod.yml**

```yaml
# docker-compose.prod.yml
# Production overrides — use with: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
services:
  backend:
    image: ghcr.io/briscanlon/family-org-backend:latest
    volumes: []
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - RABBITMQ_URL=amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672/
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=${PUBLIC_URL}/api/auth/callback
      - FRONTEND_URL=${PUBLIC_URL}
      - OLLAMA_HOST=${OLLAMA_HOST}
      - OLLAMA_MODEL=${OLLAMA_MODEL}

  worker:
    image: ghcr.io/briscanlon/family-org-backend:latest
    volumes: []
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - RABBITMQ_URL=amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672/
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=${PUBLIC_URL}/api/auth/callback
      - OLLAMA_HOST=${OLLAMA_HOST}
      - OLLAMA_MODEL=${OLLAMA_MODEL}

  frontend:
    image: ghcr.io/briscanlon/family-org-frontend:latest
    volumes: []
    restart: unless-stopped

  rabbitmq:
    ports: []
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    restart: unless-stopped

  db:
    ports: []
    restart: unless-stopped

  cloudflared:
    restart: always
```

Note: Setting `image:` in the override takes precedence over `build:` in the base file — Docker Compose uses the image directly when both are present. Setting `volumes: []` and `ports: []` overrides the base file's values.

- [ ] **Step 2: Update sample.env with new variables**

Add the following to `sample.env` after the existing RabbitMQ port lines:

```env
# RabbitMQ credentials (production)
RABBITMQ_USER=family_org
RABBITMQ_PASSWORD=change-me-in-production
```

- [ ] **Step 3: Verify compose config is valid**

Run: `cd /home/brian/git/family-org/family-org && docker compose -f docker-compose.yml -f docker-compose.prod.yml config`

Expected: Merged config output without errors. Check that backend/worker/frontend use GHCR images, volumes are empty, db/rabbitmq have no host port mappings.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml sample.env
git commit -m "feat: add production docker-compose override"
```

---

## Task 6: Test Infrastructure (compose override, env, parameterised tests)

**Files:**
- Create: `docker-compose.test.yml`
- Create: `.env.test`
- Modify: `tests/test_e2e.py`

- [ ] **Step 1: Create .env.test**

```env
# .env.test — used by CI test job
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-client-secret
PUBLIC_URL=http://localhost:8091
POSTGRES_USER=test_user
POSTGRES_PASSWORD=test_password
POSTGRES_DB=family_org_test
BACKEND_PORT=8091
FRONTEND_PORT=5181
RABBITMQ_PORT=5681
RABBITMQ_MGMT_PORT=15681
POSTGRES_PORT=5441
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
TUNNEL_TOKEN=unused
```

- [ ] **Step 2: Create docker-compose.test.yml**

```yaml
# docker-compose.test.yml
# Test overrides — disables cloudflared, uses .env.test ports
services:
  cloudflared:
    profiles:
      - disabled
```

- [ ] **Step 3: Parameterise test_e2e.py URLs**

Replace the hardcoded class variables in `tests/test_e2e.py`:

```python
import os

class TestFamilyOrgEndToEnd(unittest.TestCase):
    BACKEND_URL = os.environ.get("TEST_BACKEND_URL", "http://localhost:8090")
    FRONTEND_URL = os.environ.get("TEST_FRONTEND_URL", "http://localhost:5180")
```

This preserves the existing defaults for local development while allowing CI to override.

- [ ] **Step 4: Verify tests still run locally with defaults**

Run: `cd /home/brian/git/family-org/family-org && python -m pytest tests/test_e2e.py -v --tb=short`

Expected: Tests pass (or fail for the same reasons as before — no regressions from parameterisation).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.test.yml .env.test tests/test_e2e.py
git commit -m "feat: add test infrastructure with parameterised URLs"
```

---

## Task 7: Dependabot Configuration

**Files:**
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Create dependabot.yml**

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 3
```

Also includes `github-actions` ecosystem to keep CI action versions current.

- [ ] **Step 2: Commit**

```bash
mkdir -p .github
git add .github/dependabot.yml
git commit -m "chore: add Dependabot config for npm, pip, and actions"
```

---

## Task 8: GitHub Actions CI/CD Workflow

**Files:**
- Create: `.github/workflows/ci-deploy.yml`

This is the main workflow. It's a single file but complex, so build it up and verify the YAML is valid.

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/ci-deploy.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.event_name == 'push' && 'deploy-production' || format('pr-{0}', github.event.pull_request.number) }}
  cancel-in-progress: true

env:
  REGISTRY: ghcr.io
  BACKEND_IMAGE: ghcr.io/briscanlon/family-org-backend
  FRONTEND_IMAGE: ghcr.io/briscanlon/family-org-frontend

jobs:
  lint:
    name: Lint
    runs-on: [self-hosted, linux, x64]
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Frontend lint (ESLint)
        working-directory: frontend
        run: |
          npm ci
          npm run lint

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Backend lint (Ruff)
        working-directory: backend
        run: |
          pip install -r requirements-dev.txt
          ruff check .
          ruff format --check .

  security:
    name: Security Scan
    runs-on: [self-hosted, linux, x64]
    steps:
      - uses: actions/checkout@v4

      - name: Semgrep SAST
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/default
            p/python
            p/typescript

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Frontend dependency audit
        working-directory: frontend
        run: |
          npm ci
          npm audit --audit-level=high

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Backend dependency audit
        working-directory: backend
        run: |
          pip install pip-audit
          pip-audit -r requirements.txt

  test:
    name: E2E Tests
    runs-on: [self-hosted, linux, x64]
    steps:
      - uses: actions/checkout@v4

      - name: Start test stack
        run: |
          docker compose --env-file .env.test \
            -f docker-compose.yml \
            -f docker-compose.test.yml \
            up -d --build --wait
        timeout-minutes: 5

      - name: Wait for backend health
        run: |
          for i in $(seq 1 30); do
            if curl -sf http://localhost:8091/health; then
              echo "Backend is healthy"
              exit 0
            fi
            sleep 2
          done
          echo "Backend failed to become healthy"
          docker compose --env-file .env.test -f docker-compose.yml -f docker-compose.test.yml logs backend
          exit 1

      - name: Run E2E tests
        env:
          TEST_BACKEND_URL: http://localhost:8091
          TEST_FRONTEND_URL: http://localhost:5181
        run: |
          pip install requests pytest
          python -m pytest tests/test_e2e.py -v

      - name: Tear down test stack
        if: always()
        run: |
          docker compose --env-file .env.test \
            -f docker-compose.yml \
            -f docker-compose.test.yml \
            down -v

  build-and-push:
    name: Build & Push Images
    needs: [lint, security, test]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: [self-hosted, linux, x64]
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push backend
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          file: ./backend/Dockerfile.prod
          push: true
          tags: |
            ${{ env.BACKEND_IMAGE }}:${{ github.sha }}
            ${{ env.BACKEND_IMAGE }}:latest
          cache-from: type=registry,ref=${{ env.BACKEND_IMAGE }}:buildcache
          cache-to: type=registry,ref=${{ env.BACKEND_IMAGE }}:buildcache,mode=max

      - name: Build and push frontend
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: true
          tags: |
            ${{ env.FRONTEND_IMAGE }}:${{ github.sha }}
            ${{ env.FRONTEND_IMAGE }}:latest
          build-args: |
            VITE_API_URL=${{ vars.PUBLIC_URL }}/api
          cache-from: type=registry,ref=${{ env.FRONTEND_IMAGE }}:buildcache
          cache-to: type=registry,ref=${{ env.FRONTEND_IMAGE }}:buildcache,mode=max

  deploy:
    name: Deploy to Production
    needs: [build-and-push]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: [self-hosted, linux, x64]
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Record current SHA for rollback
        run: |
          mkdir -p /opt/family-org
          if docker inspect --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' family-org-backend-1 2>/dev/null; then
            docker inspect --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' family-org-backend-1 > /opt/family-org/.last-good-sha
          fi

      - name: Copy compose files
        run: |
          cp docker-compose.yml /opt/family-org/
          cp docker-compose.prod.yml /opt/family-org/

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Verify production .env exists
        run: |
          if [ ! -f /opt/family-org/.env ]; then
            echo "ERROR: /opt/family-org/.env not found — cannot deploy without production config"
            exit 1
          fi

      - name: Pull images
        working-directory: /opt/family-org
        run: |
          docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml pull

      - name: Run database migrations
        working-directory: /opt/family-org
        run: |
          docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml run --rm backend alembic upgrade head

      - name: Deploy
        working-directory: /opt/family-org
        run: |
          docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d

      - name: Health check
        run: |
          sleep 10
          for i in $(seq 1 15); do
            BACKEND_OK=false
            FRONTEND_OK=false
            if curl -sf http://localhost:${BACKEND_PORT:-8090}/health; then
              BACKEND_OK=true
            fi
            if curl -sf http://localhost:${FRONTEND_PORT:-5180}/; then
              FRONTEND_OK=true
            fi
            if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
              echo "Deployment healthy (backend + frontend)"
              exit 0
            fi
            sleep 5
          done
          echo "Health check failed — initiating rollback"
          exit 1

      - name: Rollback on failure
        if: failure()
        working-directory: /opt/family-org
        run: |
          if [ -f .last-good-sha ]; then
            PREV_SHA=$(cat .last-good-sha)
            echo "Rolling back to $PREV_SHA"
            docker pull ${{ env.BACKEND_IMAGE }}:$PREV_SHA
            docker pull ${{ env.FRONTEND_IMAGE }}:$PREV_SHA
            docker tag ${{ env.BACKEND_IMAGE }}:$PREV_SHA ${{ env.BACKEND_IMAGE }}:latest
            docker tag ${{ env.FRONTEND_IMAGE }}:$PREV_SHA ${{ env.FRONTEND_IMAGE }}:latest
            docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d
          else
            echo "No previous SHA found — cannot rollback (first deploy?)"
          fi
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci-deploy.yml'))" && echo "Valid YAML"`

Expected: `Valid YAML` (install pyyaml if needed: `pip install pyyaml`)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci-deploy.yml
git commit -m "feat: add GitHub Actions CI/CD pipeline"
```

---

## Task 9: Self-Hosted Runner Setup (Manual — on 192.168.5.71)

This task is performed manually on the target server, not via code changes.

- [ ] **Step 1: Create the github-runner user on 192.168.5.71**

SSH into the server and run:

```bash
sudo useradd -m -s /bin/bash github-runner
sudo usermod -aG docker github-runner
```

- [ ] **Step 2: Install the GitHub Actions runner**

Go to GitHub: `https://github.com/BriScanlon/family-org/settings/actions/runners/new`

Follow the instructions there to download and configure the runner. Run these as the `github-runner` user:

```bash
sudo su - github-runner
mkdir actions-runner && cd actions-runner
# Download the latest runner (URL from GitHub settings page)
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.XXX.X/actions-runner-linux-x64-2.XXX.X.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/BriScanlon/family-org --token <TOKEN_FROM_GITHUB>
```

Use labels: `self-hosted,linux,x64`

- [ ] **Step 3: Install as a systemd service**

```bash
sudo ./svc.sh install github-runner
sudo ./svc.sh start
sudo ./svc.sh status
```

Expected: Service is active and running.

- [ ] **Step 4: Verify prerequisites**

```bash
docker --version        # Docker 20+
docker compose version  # Docker Compose v2+
git --version           # Git 2.x
node --version          # Node 20.x (install via nodesource if needed)
python3 --version       # Python 3.11 (install via deadsnakes PPA if needed)
```

- [ ] **Step 5: Prepare the deployment directory**

```bash
sudo mkdir -p /opt/family-org
sudo chown github-runner:github-runner /opt/family-org
```

Create the production `.env` file at `/opt/family-org/.env` with real credentials (copy from `sample.env` and fill in production values). **Important:** `RABBITMQ_USER` and `RABBITMQ_PASSWORD` must be set and consistent — they are used both for the RabbitMQ server credentials (`RABBITMQ_DEFAULT_USER`/`RABBITMQ_DEFAULT_PASS`) and the backend/worker connection URL (`RABBITMQ_URL`).

- [ ] **Step 6: Set up GitHub repository variable**

Go to `https://github.com/BriScanlon/family-org/settings/variables/actions` and create:
- `PUBLIC_URL` = your production URL (e.g., `https://family.yourdomain.com`)

This is used as the `VITE_API_URL` build arg for the frontend image.

- [ ] **Step 7: Verify runner appears in GitHub**

Go to `https://github.com/BriScanlon/family-org/settings/actions/runners`

Expected: Runner shows as "Idle" with labels `self-hosted, linux, x64`.

---

## Task 10: Branch Protection & First Deploy Verification

- [ ] **Step 1: Configure branch protection in GitHub**

Go to `https://github.com/BriScanlon/family-org/settings/branches`

Add rule for `main`:
- Require pull request reviews before merging
- Require status checks to pass: `Lint`, `Security Scan`, `E2E Tests`
- Do not allow bypassing the above settings

- [ ] **Step 2: Test the pipeline end-to-end**

Create a test branch, make a trivial change, push, and open a PR:

```bash
git checkout -b ci/test-pipeline
echo "# CI test" >> README.md
git add README.md
git commit -m "ci: test pipeline"
git push -u origin ci/test-pipeline
```

Open a PR to `main` via GitHub UI or `gh pr create`.

Expected: Lint, Security Scan, and E2E Tests jobs run. Build & Push and Deploy do NOT run (PR only).

- [ ] **Step 3: Merge the PR and verify deploy**

Merge the PR to `main`.

Expected: All check jobs run, then Build & Push runs, then Deploy runs. The production stack at 192.168.5.71 is updated.

Verify: `curl http://192.168.5.71:8090/health` returns `{"status": "ok"}`.

- [ ] **Step 4: Commit any pipeline fixes discovered during verification**

If any workflow adjustments are needed, fix them and push directly (branch protection can be temporarily relaxed for this bootstrapping step, or push fixes via another PR).
