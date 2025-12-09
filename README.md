# <img src="./frontend/public/favicon.svg" alt="FairKeep logo" width="28" height="28" style="vertical-align: middle;" /> FairKeep

Web app that lets you track and split expenses among multiple users. Backend: Django REST (Django 5 + DRF) with Postgres in production and SQLite for quick local runs. Frontend: React (Vite).

## Features
- Split methods: equal, manual/exact, percentage, shares, full owed/owe, excess.
- Session auth with CSRF protection; balances per user/currency, settle-up flow, and activity log.
- CSV export per user with filename `{username}_YYYY-MM-DDTHH-MM-SS.csv` ordered oldest→newest (UTC timestamps).
- Responsive UI (mobile-first) with bottom navigation and two-step expense form.
- Django admin at `/admin`.

## docker-compose example
```yaml
services:
  db:
    image: postgres:16
    env_file: .env
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    env_file: .env
    working_dir: /app/fairkeep
    command: >
      sh -c "python manage.py migrate --noinput &&
             python manage.py runserver 0.0.0.0:8000"
    depends_on:
      - db
    ports:
      - "8000:8000"

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL}
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "5173:80"

volumes:
  db_data:
```

## Environment (.env)
Place a `.env` in the repo root; Docker Compose picks it up automatically and passes values to the backend and frontend build. Suggested contents for local/dev:
```env
DJANGO_SECRET_KEY=changeme
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
DJANGO_CORS_ORIGINS=http://localhost:5173
DJANGO_TIME_ZONE=Etc/UTC

POSTGRES_DB=fairkeep
POSTGRES_USER=fairkeep_user
POSTGRES_PASSWORD=strongpassword
POSTGRES_HOST=db
POSTGRES_PORT=5432

VITE_API_BASE_URL=http://localhost:8000/api/
```

Adjust hosts/CORS to match your domain (e.g., `https://fairkeep.fyulita.xyz`) and set `DJANGO_DEBUG=False` plus a strong `DJANGO_SECRET_KEY` for production. `VITE_API_BASE_URL` must end with `/api/`.

## Run with Docker Compose
This repo ships with `docker-compose.yml` tuned for local usage (Django runserver + hot-reload volume, Vite build served by Nginx).

1) Create/adjust `docker-compose.yml` and`.env` as above.  
2) Build and start:
   ```bash
   docker compose up --build -d
   ```
3) Create a superuser:
   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```
4) Access:
   - Backend API/admin: `http://localhost:8000/`
   - Frontend: `http://localhost:5173/`

Ports are mapped for local convenience (`5433` on the host → Postgres `5432` in the container). The backend mounts `./fairkeep` for live reload. For production, swap `python manage.py runserver`.

## Local development without Docker
- Backend: `cd fairkeep && python manage.py runserver` (requires local dependencies from `requirements.txt`).
- Frontend: `cd frontend && npm install && npm run dev -- --host`.
- Set `VITE_API_BASE_URL` to your backend URL (default `http://localhost:8000/api/`).

# License
- See `LICENSE.md`.
