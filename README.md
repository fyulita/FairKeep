# FairKeep

Web app to track and split expenses among multiple users. Backend: Django REST + Postgres. Frontend: React (Vite). Docker-ready with nginx/Gunicorn.

## Features
- Split methods: equal, manual/exact, percentage, shares, full owed/owe, excess.
- Session auth with CSRF protection.
- Per-user/per-currency balances, settle-up flow, activity log.
- CSV export of all expenses for the logged-in user (nets per participant and split options).
- Django admin at `/admin`.

## Requirements
- Docker and Docker Compose.

## docker-compose example
```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      DJANGO_SECRET_KEY: changeme
      DJANGO_DEBUG: "False"
      DJANGO_ALLOWED_HOSTS: subdomain.domain.com,localhost,127.0.0.1
      DJANGO_CSRF_TRUSTED_ORIGINS: https://subdomain.domain.com
      DJANGO_CORS_ORIGINS: https://subdomain.domain.com
      DJANGO_TIME_ZONE: Etc/UTC
      POSTGRES_DB: fairkeep
      POSTGRES_USER: fairkeep_user
      POSTGRES_PASSWORD: strongpassword
      POSTGRES_HOST: db
      POSTGRES_PORT: "5432"
    command: >
      sh -c "python fairkeep/manage.py migrate --noinput &&
             gunicorn fairkeep.wsgi:application --bind 0.0.0.0:8000"
    depends_on:
      - db
    ports:
      - "8000:8000"
    volumes:
      - static_data:/app/fairkeep/staticfiles
      - media_data:/app/fairkeep/media
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    build:
      args:
        VITE_API_BASE_URL: https://subdomain.domain.com/api/
    ports:
      - "80:80"
    depends_on:
      - backend
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: fairkeep 
      POSTGRES_USER: fairkeep_user 
      POSTGRES_PASSWORD: strongpassword
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
  static_data:
  media_data:
```
You can also place these environment variables in `.env` and keep compose cleaner.

## Run with Docker
1) Configure `docker-compose.yml` file and fill values.
2) Build and start:
   ```bash
   docker compose build
   docker compose up -d
   ```
4) Reverse proxy routing:
   - `https://subdomain.domain.com/`  -> service `frontend:80`
   - `https://subdomain.domain.com/api/` and `/admin` -> service `backend:8000`
5) Create a superuser (if needed):
   ```bash
   docker compose exec backend python fairkeep/manage.py createsuperuser
   ```

## Services (docker-compose.yml)
- `db`: Postgres 16 with volume `db_data`.
- `backend`: Django + Gunicorn, applies migrations on start, volumes `static_data` and `media_data`.
- `frontend`: Nginx serving the Vite build.

## Local development (optional)
- Backend: `python manage.py runserver` (requires local deps).
- Frontend: `cd frontend && npm install && npm run dev -- --host`.
- API base via `VITE_API_BASE_URL` (default `https://localhost:8000/api/`).

## CSV export
In the user profile, “Download expenses CSV” generates `{username}_YYYY-MM-DDTHH-MM-SS.csv` with expenses ordered oldest→newest and per-user nets.

## License
See [LICENSE.md](LICENSE.md).
