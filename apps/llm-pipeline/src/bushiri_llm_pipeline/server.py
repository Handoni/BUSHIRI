from fastapi import FastAPI, Header, HTTPException

from .config import Settings
from .pipeline import parse_market_post
from .schemas import ParsedMarketPost, ParseMarketPostRequest

app = FastAPI(title="BUSHIRI LLM Pipeline")


def get_settings() -> Settings:
    return Settings.from_env()


def require_pipeline_token(settings: Settings, authorization: str | None) -> None:
    if not settings.pipeline_token:
        return

    expected = f"Bearer {settings.pipeline_token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid pipeline token")


@app.get("/health")
async def health() -> dict[str, bool | str]:
    return {"ok": True, "service": "BUSHIRI LLM Pipeline"}


@app.post("/parse-market-post", response_model=ParsedMarketPost)
async def parse_market_post_endpoint(
    request: ParseMarketPostRequest,
    authorization: str | None = Header(default=None),
) -> ParsedMarketPost:
    settings = get_settings()
    require_pipeline_token(settings, authorization)
    return await parse_market_post(request, settings)
