import os
from typing import Literal, Mapping

from pydantic import BaseModel

DEFAULT_PROVIDER = "google-gla"
DEFAULT_MODEL = "gemma-3-27b-it"


class Settings(BaseModel):
    google_api_key: str
    provider: Literal["google-gla"] = DEFAULT_PROVIDER
    model: str = DEFAULT_MODEL
    pipeline_token: str | None = None

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "Settings":
        source = environ or os.environ
        return cls(
            google_api_key=source["GOOGLE_API_KEY"],
            provider=DEFAULT_PROVIDER,
            model=source.get("LLM_MODEL", DEFAULT_MODEL),
            pipeline_token=source.get("LLM_PIPELINE_TOKEN"),
        )
