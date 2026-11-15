# Frontend and backend deployment

The repository contains the Django API and Gemini RAG service in `backend/`. The frontend loads mission narration from Django when the API is available and keeps its local models, visual metadata, and story fallback available offline. Ask the Archive uses the same API and renders retrieved NASA source links.

## Local run

1. Create and activate a Python environment in `backend/`; install `requirements.txt`.
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` in your shell or local environment loader. Django reads environment variables directly.
3. From `backend/`, run `python manage.py runserver 8000`.
4. In `Front/.env`, set `VITE_API_BASE_URL=http://localhost:8000`, then start Vite.

The API exposes `/api/health/`, `/api/planets/`, `/api/planets/{planet}/missions/`, `/api/missions/{id}/`, and `/api/ai/ask/`. Chat history accepts `{role, text}` from the frontend and `{role, content}` for compatibility with the RAG inspection wrapper.

## Cloud deployment

The frontend is served by the existing Cloudflare Worker. Its `/api/*` routes are proxied server-side to Render, so production does not need a browser CORS exception or an API URL compiled into the JavaScript bundle.

Deploy the Django service on Render from the repository's `render.yaml`. On first Blueprint creation, provide `GEMINI_API_KEY` and `CORS_ALLOWED_ORIGINS` (set the latter to the exact Cloudflare site origin, e.g. `https://space-legacy.abdalla556892.workers.dev`). Render provides the API hostname after the service is created.

Set the Cloudflare Worker variable `BACKEND_ORIGIN` to that Render service origin (for example, `https://space-legacy-api.onrender.com`) in the Worker's Settings → Variables and Secrets. It must be only the origin, with no `/api` suffix. The frontend calls same-origin `/api/*` paths and the Worker forwards them to Django. Do not set `VITE_API_BASE_URL` for the production Worker build; retain it only for local development.

Build and deploy from the repository root with `npm --prefix Front run build` followed by `npx wrangler deploy`. Check `https://<cloudflare-host>/api/health/` for a healthy response and `https://<render-host>/api/health/` for the direct backend health check. The Render health check path is already declared in `render.yaml`.

The `backend/data/fast_api/main.py` file is an optional local RAG inspection wrapper. Production requests use Django at `/api/ai/ask/`, which calls the shared `backend/ai/rag.py` pipeline; do not deploy a second AI service.
