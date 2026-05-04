# BUSHIRI LLM Pipeline

PydanticAI-based parser service for market posts.

## Environment

```bash
export GOOGLE_API_KEY="..."
export LLM_MODEL="gemma-3-27b-it"
export LLM_PIPELINE_TOKEN="optional-worker-shared-token"
```

## Run

```bash
uv run uvicorn bushiri_llm_pipeline.server:app --app-dir src --host 0.0.0.0 --port 8790
```

The Worker should point `LLM_PIPELINE_URL` to:

```text
https://<pipeline-host>/parse-market-post
```
