import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from bushiri_llm_pipeline.config import Settings
from bushiri_llm_pipeline.pipeline import MARKET_AGENT_INSTRUCTIONS, build_agent_prompt
from bushiri_llm_pipeline.schemas import ParsedMarketPost, ParseMarketPostRequest


class MarketPipelineTest(unittest.TestCase):
    def test_defaults_to_google_ai_studio_gemma_3_27b(self) -> None:
        settings = Settings(google_api_key="google-key")

        self.assertEqual(settings.provider, "google-gla")
        self.assertEqual(settings.model, "gemma-3-27b-it")

    def test_worker_provider_env_does_not_override_google_provider(self) -> None:
        settings = Settings.from_env(
            {
                "GOOGLE_API_KEY": "google-key",
                "LLM_PROVIDER": "pydantic_ai",
            }
        )

        self.assertEqual(settings.provider, "google-gla")

    def test_builds_prompt_with_vendor_and_raw_text(self) -> None:
        request = ParseMarketPostRequest(
            model="gemma-3-27b-it",
            vendorName="성전물산",
            rawText="광어 kg 4.8",
        )

        prompt = build_agent_prompt(request)
        payload = json.loads(prompt)

        self.assertEqual(payload["vendorName"], "성전물산")
        self.assertEqual(payload["rawText"], "광어 kg 4.8")
        self.assertIn("strict JSON", MARKET_AGENT_INSTRUCTIONS)

    def test_validates_market_post_output_schema(self) -> None:
        parsed = ParsedMarketPost.model_validate(
            {
                "vendorName": "성전물산",
                "marketDate": "2026-04-24",
                "categoryHint": "fish",
                "warnings": [],
                "items": [
                    {
                        "category": "fish",
                        "canonicalName": "광어",
                        "displayName": "자연산 광어",
                        "origin": "국내산",
                        "productionType": "자연산",
                        "freshnessState": None,
                        "grade": None,
                        "sizeMinKg": 2,
                        "sizeMaxKg": 3,
                        "unit": "kg",
                        "pricePerKg": 48000,
                        "priceText": "kg 4.8",
                        "soldOut": False,
                        "eventFlag": False,
                        "halfAvailable": False,
                        "notes": None,
                        "confidence": 0.92,
                    }
                ],
            }
        )

        self.assertEqual(parsed.items[0].unit, "kg")
        self.assertEqual(parsed.items[0].pricePerKg, 48000)


if __name__ == "__main__":
    unittest.main()
