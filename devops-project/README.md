# DevOps Project – Auth + CRUD App (Dockerized)

A full-stack "Items Manager" application: register/login with a JWT-secured
backend, then create, complete, and delete personal items. The whole stack
runs with a single `docker-compose up`.

## Architecture

```
┌─────────────┐      /api/*      ┌─────────────┐      SQL       ┌─────────────┐
│  frontend   │ ───────────────▶ │   backend   │ ──────────────▶ │     db      │
│  (nginx,    │   proxy_pass     │ (Node.js /  │   pg driver     │ (PostgreSQL │
│  static     │                  │  Express)   │                 │  16)        │
│  HTML/JS)   │                  │  port 5000  │                 │  port 5432  │
│  port 8080  │                  └─────────────┘                 └─────────────┘
└─────────────┘
```

- **frontend** – plain HTML/CSS/JS, served by nginx. Nginx also reverse-proxies
  any request to `/api/*` over to the backend container, so the browser only
  ever talks to one origin (port 8080) and there are no CORS headaches.
- **backend** – Node.js + Express REST API. Handles registration/login
  (bcrypt password hashing + JWT issuing) and item CRUD (JWT-protected).
- **db** – PostgreSQL 16. Schema (`users`, `items`) is created automatically
  on first boot from `backend/init.sql`.

Each layer is a separate Docker image/container, connected over a private
Docker bridge network (`app_network`) defined in `docker-compose.yml`. Only
the frontend needs to be exposed to the outside world in a real deployment;
here all three are published for local development convenience.

## Project structure

```
devops-project/
├── backend/
│   ├── routes/
│   │   ├── auth.js        # /api/auth/register, /api/auth/login
│   │   └── items.js       # /api/items CRUD (JWT protected)
│   ├── middleware/
│   │   └── auth.js        # JWT verification middleware
│   ├── db.js               # PostgreSQL connection pool
│   ├── init.sql             # DB schema, auto-run on first container start
│   ├── server.js            # Express app entrypoint + /api/health
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── index.html          # Dashboard (items list, protected client-side)
│   ├── login.html
│   ├── register.html
│   ├── app.js               # Shared fetch helpers
│   ├── style.css
│   ├── nginx.conf           # Static serving + /api proxy_pass to backend
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── .gitignore
```

## Docker images (Docker Hub)

Images are published to Docker Hub:

- Backend: `aqsa9922/devops-project-backend:latest`
- Frontend: `aqsa9922/devops-project-frontend:latest`

Docker Hub links (share these in your report):
- https://hub.docker.com/r/aqsa9922/devops-project-backend
- https://hub.docker.com/r/aqsa9922/devops-project-frontend

## Running it

1. Install Docker + Docker Compose.
2. Copy the env file: `cp .env.example .env` (edit `JWT_SECRET` if you like).
3. From the project root:
   ```bash
   docker compose up --build
   ```
4. Open the app:
   - Frontend: http://localhost:8080
   - Backend directly (optional): http://localhost:5000/api/health
   - Postgres (optional, e.g. via psql/DBeaver): localhost:5432

5. Register a user, log in, and add/complete/delete items.

To stop: `docker compose down` (add `-v` to also wipe the DB volume).

## Publishing images to Docker Hub

1. Create a free account at hub.docker.com if you don't have one (username
   used below: `aqsa9922`).
2. Log in from your terminal:
   ```bash
   docker login -u aqsa9922
   ```
   (enter your Docker Hub password or an access token when prompted)
3. Build and tag each image (run from the project root):
   ```bash
   docker build -t aqsa9922/devops-project-backend:latest ./backend
   docker build -t aqsa9922/devops-project-frontend:latest ./frontend
   ```
4. Push them:
   ```bash
   docker push aqsa9922/devops-project-backend:latest
   docker push aqsa9922/devops-project-frontend:latest
   ```
5. Docker Hub repos are **public by default** on the free tier, so no extra
   visibility step needed. Your image links (put these in your report):
   - https://hub.docker.com/r/aqsa9922/devops-project-backend
   - https://hub.docker.com/r/aqsa9922/devops-project-frontend

### Running from the published images (instead of building locally)

Once pushed, anyone can run your app without your source code, using
`docker-compose.prod.yml` (included in this project, already pointed at
`aqsa9922`'s images):

```bash
docker compose -f docker-compose.prod.yml up
```

## How the pieces talk to each other

- **Service discovery**: inside the `app_network`, containers reach each
  other by service name (`db`, `backend`, `frontend`) — that's why
  `backend/db.js` connects to host `db`, and `frontend/nginx.conf` proxies
  to `http://backend:5000`. Docker's built-in DNS resolves these names.
- **Startup ordering**: `depends_on` + a Postgres `healthcheck` make sure
  the backend doesn't try to connect before Postgres is actually ready to
  accept connections, not just "container started."
- **Persistence**: the named volume `db_data` keeps your Postgres data
  across `docker compose down`/`up` cycles (removed only with `down -v`).
- **Config via environment variables**: DB credentials and the JWT secret
  are injected via `.env` / `docker-compose.yml`, not hardcoded — the
  standard 12-factor approach, and what you'd point to different secrets
  managers/values in staging vs. production.

## API reference

| Method | Route                | Auth | Description                     |
|--------|-----------------------|------|----------------------------------|
| POST   | `/api/auth/register`  | No   | Create a new user                |
| POST   | `/api/auth/login`     | No   | Log in, returns a JWT            |
| GET    | `/api/items`          | Yes  | List the logged-in user's items  |
| POST   | `/api/items`          | Yes  | Create an item                   |
| PUT    | `/api/items/:id`      | Yes  | Update an item (title/desc/done) |
| DELETE | `/api/items/:id`      | Yes  | Delete an item                   |
| GET    | `/api/health`         | No   | Health check (used by Docker)    |

Protected routes expect `Authorization: Bearer <token>`.

## DevOps talking points (useful for your writeup/viva)

- **Multi-container architecture**: 3 services, each single-responsibility,
  each with its own Dockerfile — mirrors how you'd split things in
  production (and how you'd scale/replace each independently).
- **Multi-stage-friendly Dockerfiles**: small base images (`node:20-alpine`,
  `nginx:alpine`, `postgres:16-alpine`) to keep image size down.
- **Layer caching**: backend Dockerfile copies `package*.json` and runs
  `npm install` *before* copying the rest of the source, so code changes
  don't force a full dependency reinstall on rebuild.
- **Healthchecks**: all three containers define one, and `docker-compose`
  uses the DB's healthcheck to gate backend startup.
- **Networking**: a dedicated bridge network isolates the app's internal
  traffic; nginx acts as a reverse proxy / single entry point, which is
  also how you'd slot in TLS termination or a load balancer later.
- **Statelessness of the backend**: the backend keeps no session state
  (auth is JWT-based), so you could scale it to multiple replicas behind
  the same nginx proxy without sticky sessions.
- **Config/secrets separation**: `.env` files are gitignored;
  `.env.example` documents what's needed without leaking real secrets.
- **Possible extensions** if you want to go further for the project: a
  CI pipeline (GitHub Actions) that builds/pushes images, a
  `docker-compose.prod.yml` with resource limits, or swapping
  `docker-compose` for Kubernetes manifests.

## Security notes

- Passwords are hashed with bcrypt before storage — never stored in plain text.
- JWT secret and DB password are read from environment variables — change
  the defaults before using this anywhere beyond your own machine.
- Item routes double-check `user_id` on every query, so one user can never
  read/edit/delete another user's items even if they guess an item ID.
