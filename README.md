# BUSHIRI

Phase 1 scaffold for the BUSHIRI MVP.

## Workspace

- `apps/worker`: Cloudflare Worker API
- `apps/web`: Vite + React frontend scaffold
- `apps/llm-pipeline`: PydanticAI parser service using Google AI Studio

## Commands

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
```

## LLM pipeline

```bash
cd apps/llm-pipeline
export GOOGLE_API_KEY="..."
export LLM_MODEL="gemma-3-27b-it"
uv run uvicorn bushiri_llm_pipeline.server:app --app-dir src --host 0.0.0.0 --port 8790
```

Configure the Worker with `LLM_PROVIDER=pydantic_ai`, `LLM_MODEL=gemma-3-27b-it`, and `LLM_PIPELINE_URL` pointing to `/parse-market-post`.

## Local D1 migration

```bash
pnpm --filter @bushiri/worker d1:migrate:local
```

## Remote D1 migration

```bash
pnpm --filter @bushiri/worker d1:migrate:remote
```

## Cloudflare Pages API proxy

The Vite app calls same-origin `/api/*` endpoints. In Cloudflare Pages, those requests
must be handled by the Pages Function in `apps/web/functions/api/[[path]].js`; otherwise
Pages serves the SPA `index.html` fallback for API URLs.

Set a Pages runtime variable in production and preview:

```bash
BUSHIRI_API_ORIGIN=https://<deployed-worker-api-origin>
```

Use the Worker API origin, not the Pages origin.
