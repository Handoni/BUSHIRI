import json

from .config import Settings
from .schemas import ParsedMarketPost, ParseMarketPostRequest

MARKET_AGENT_INSTRUCTIONS = (
    "Extract Korean seafood market post text into strict JSON. "
    "Return only fields matching the ParsedMarketPost schema: vendorName, marketDate, "
    "categoryHint, warnings, and items. Each item must include category, canonicalName, "
    "displayName, origin, productionType, freshnessState, grade, sizeMinKg, sizeMaxKg, "
    "unit, pricePerKg, priceText, soldOut, eventFlag, halfAvailable, notes, and confidence. "
    "Use unit='kg'. Interpret shorthand Korean price notation conservatively, and add warnings "
    "when price, origin, size, or sold-out status is ambiguous."
)


def build_agent_prompt(request: ParseMarketPostRequest) -> str:
    return json.dumps(
        {
            "vendorName": request.vendorName,
            "rawText": request.rawText,
        },
        ensure_ascii=False,
    )


def create_market_agent(settings: Settings, model_name: str | None = None):
    from pydantic_ai import Agent
    from pydantic_ai.models.google import GoogleModel
    from pydantic_ai.providers.google import GoogleProvider

    provider = GoogleProvider(api_key=settings.google_api_key)
    model = GoogleModel(model_name or settings.model, provider=provider)
    return Agent(model, output_type=ParsedMarketPost, instructions=MARKET_AGENT_INSTRUCTIONS)


async def parse_market_post(request: ParseMarketPostRequest, settings: Settings) -> ParsedMarketPost:
    agent = create_market_agent(settings, model_name=request.model)
    result = await agent.run(build_agent_prompt(request))
    return result.output
