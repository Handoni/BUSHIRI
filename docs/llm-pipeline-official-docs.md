# LLM Pipeline Official Docs Notes

수집일: 2026-05-04

## 적용 방향

BUSHIRI의 LLM 파싱은 Python `apps/llm-pipeline` 서비스에서 PydanticAI `Agent`를 실행하고, Cloudflare Worker는 이 파이프라인의 `/parse-market-post` 엔드포인트를 호출한다. Worker 런타임은 TypeScript/Cloudflare Workers라 PydanticAI를 직접 import할 수 없기 때문에, PydanticAI 실행 경계는 별도 Python 서비스로 분리했다.

## 공식 문서 근거

- PydanticAI Google provider 문서는 Google 모델 사용 시 `pydantic-ai-slim[google]` 설치, Google AI Studio에서 만든 `GOOGLE_API_KEY`, `google-gla` 계열 모델 호출, `GoogleModel`과 `GoogleProvider` 직접 생성 방식을 안내한다. 이 구조를 `apps/llm-pipeline/src/bushiri_llm_pipeline/pipeline.py`에 적용했다.
- PydanticAI output 문서는 `Agent(..., output_type=SomePydanticModel)` 형태로 Pydantic 모델에 맞는 구조화 출력을 강제하고, 반환값이 `result.output`에 보존된다고 설명한다. 이 근거로 `ParsedMarketPost` Pydantic 모델을 `output_type`으로 사용했다.
- Google Gemma 3 공식 개요와 모델 카드는 Gemma 3가 27B 크기를 포함하고, 4B/12B/27B 모델이 128K 컨텍스트와 함수 호출을 지원한다고 설명한다. 요청 사항에 맞춰 기본 모델 ID는 `gemma-3-27b-it`로 설정했다.
- Google의 현재 “Run Gemma with the Gemini API” 문서는 Google AI Studio에서 Gemini API 키를 발급받는 흐름과 Gemma API 호출 방식을 안내한다. 다만 2026-05-04 기준 현재 페이지의 예시는 Gemma 4 모델 ID를 보여준다. 따라서 AI Studio에서 `gemma-3-27b-it` 접근이 거부되면, Google의 최신 Gemma API 모델 목록에 맞춰 `LLM_MODEL`만 교체하면 된다.

## Sources

- [PydanticAI Google models](https://pydantic.dev/docs/ai/models/google)
- [PydanticAI structured output](https://pydantic.dev/docs/ai/core-concepts/output/)
- [Google Gemma 3 overview](https://ai.google.dev/gemma/docs/core)
- [Google Gemma 3 model card](https://ai.google.dev/gemma/docs/core/model_card_3)
- [Run Gemma with the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
