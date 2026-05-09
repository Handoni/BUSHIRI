import json

from .config import Settings
from .schemas import ParsedMarketPost, ParseMarketPostRequest

MARKET_AGENT_INSTRUCTIONS = (
    "Extract Korean seafood market post text into strict JSON. "
    "Return only fields matching the ParsedMarketPost schema: vendorName, marketDate, "
    "categoryHint, warnings, and items. Each item must include category, canonicalName, "
    "displayName, origin, originCountry, originDetail, productionType, freshnessState, grade, sizeMinKg, sizeMaxKg, "
    "unit, pricePerKg, priceText, soldOut, eventFlag, halfAvailable, notes, and confidence. "
    "Keep origin as a country-compatible value and set originCountry to the country bucket "
    "(국내산, 일본산, 중국산, 노르웨이, 러시아, or the stated country). Set originDetail to exactly "
    "one display detail using priority 낚시바리 > 자연산 > 지역산 > 양식; leave it null when only a country is known. "
    "For example 제주산 양식 광어 has originCountry='국내산' and originDetail='제주산', while 국내산 낚시바리 자연산 광어 has originDetail='낚시바리'. "
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
