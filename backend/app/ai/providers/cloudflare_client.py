"""
Cloudflare Workers AI Client.

Provides access to Cloudflare's edge AI inference.
Free tier: 10,000 neurons/day.
"""

import os
import logging
import asyncio
from typing import Optional

import httpx

from .base import LLMResponse, LLMProvider

logger = logging.getLogger(__name__)


class CloudflareAIClient:
    """Client for Cloudflare Workers AI."""

    # Model pricing (free tier has 10k neurons/day, then pay-as-you-go)
    # Pricing is per 1M neurons (roughly equivalent to tokens)
    MODEL_COSTS = {
        "@cf/meta/llama-3.2-3b-instruct": {"input": 0.0, "output": 0.0},  # Free tier
        "@cf/meta/llama-3-8b-instruct": {"input": 0.0, "output": 0.0},
        "@cf/meta/llama-3.1-8b-instruct": {"input": 0.0, "output": 0.0},
        "@cf/mistral/mistral-7b-instruct-v0.1": {"input": 0.0, "output": 0.0},
        "@cf/qwen/qwen1.5-7b-chat-awq": {"input": 0.0, "output": 0.0},
    }

    def __init__(
        self,
        account_id: Optional[str] = None,
        api_token: Optional[str] = None,
        model: Optional[str] = None
    ):
        self.account_id = account_id or os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.api_token = api_token or os.getenv("CLOUDFLARE_API_TOKEN")
        self.model = model or os.getenv("CLOUDFLARE_AI_MODEL", "@cf/meta/llama-3.2-3b-instruct")
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run"

    @property
    def provider_name(self) -> str:
        return LLMProvider.CLOUDFLARE.value

    def _calculate_cost(self, tokens_input: int, tokens_output: int) -> float:
        """Calculate estimated cost (free tier = $0)."""
        # Cloudflare Workers AI is free for 10k neurons/day
        # After that it's $0.011 per 1k neurons for regular, less for quantized
        # For now, assume free tier
        return 0.0

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """
        Generate a response using Cloudflare Workers AI.

        Args:
            prompt: User prompt
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum tokens in response
            system_prompt: Optional system prompt

        Returns:
            LLMResponse with generated content
        """
        if not self.account_id or not self.api_token:
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Cloudflare credentials not configured",
                provider=self.provider_name
            )

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/{self.model}",
                    json=payload,
                    headers=headers
                )

                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        result = data.get("result", {})
                        content = result.get("response", "")
                        usage = result.get("usage", {})
                        tokens_input = usage.get("prompt_tokens", 0)
                        tokens_output = usage.get("completion_tokens", 0)
                        tokens_total = usage.get("total_tokens", tokens_input + tokens_output)

                        return LLMResponse(
                            content=content,
                            tokens_used=tokens_total,
                            model=self.model,
                            success=True,
                            provider=self.provider_name,
                            tokens_input=tokens_input,
                            tokens_output=tokens_output,
                            estimated_cost=self._calculate_cost(tokens_input, tokens_output)
                        )
                    else:
                        errors = data.get("errors", [])
                        error_msg = errors[0].get("message") if errors else "Unknown error"
                        return LLMResponse(
                            content="",
                            tokens_used=0,
                            model=self.model,
                            success=False,
                            error=f"Cloudflare API error: {error_msg}",
                            provider=self.provider_name
                        )
                elif response.status_code == 401:
                    return LLMResponse(
                        content="",
                        tokens_used=0,
                        model=self.model,
                        success=False,
                        error="Cloudflare authentication failed - check API token",
                        provider=self.provider_name
                    )
                elif response.status_code == 429:
                    return LLMResponse(
                        content="",
                        tokens_used=0,
                        model=self.model,
                        success=False,
                        error="Cloudflare rate limit exceeded",
                        provider=self.provider_name
                    )
                else:
                    return LLMResponse(
                        content="",
                        tokens_used=0,
                        model=self.model,
                        success=False,
                        error=f"Cloudflare API error: {response.status_code}",
                        provider=self.provider_name
                    )

        except httpx.TimeoutException:
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Cloudflare request timed out",
                provider=self.provider_name
            )
        except Exception as e:
            logger.error(f"Cloudflare AI error: {e}")
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error=str(e),
                provider=self.provider_name
            )

    def generate_sync(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """Synchronous wrapper for generate()."""
        return asyncio.run(self.generate(prompt, temperature, max_tokens, system_prompt))

    async def is_available(self) -> bool:
        """Check if Cloudflare Workers AI is available."""
        if not self.account_id or not self.api_token:
            return False

        try:
            # Quick test with minimal tokens
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/{self.model}",
                    json={"messages": [{"role": "user", "content": "hi"}], "max_tokens": 1},
                    headers={
                        "Authorization": f"Bearer {self.api_token}",
                        "Content-Type": "application/json"
                    }
                )
                return response.status_code == 200
        except Exception:
            return False
