from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ParseMarketPostRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str
    vendorName: str | None = None
    rawText: str = Field(min_length=1)


class ParsedMarketItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Literal["fish", "crustacean", "shellfish", "salmon", "other"]
    canonicalName: str | None
    displayName: str
    origin: str | None
    productionType: str | None
    freshnessState: str | None
    grade: str | None
    sizeMinKg: float | None
    sizeMaxKg: float | None
    unit: Literal["kg"]
    pricePerKg: float | None
    priceText: str
    soldOut: bool
    eventFlag: bool
    halfAvailable: bool
    notes: str | None
    confidence: float = Field(ge=0, le=1)


class ParsedMarketPost(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vendorName: str | None
    marketDate: str | None
    categoryHint: Literal["fish", "crustacean", "mixed"] | None
    items: list[ParsedMarketItem]
    warnings: list[str]
