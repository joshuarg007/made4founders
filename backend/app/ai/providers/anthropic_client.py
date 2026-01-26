"""
Anthropic LLM Client.

Implements the LLMClientProtocol for Anthropic's Claude API.
Uses httpx for async/sync HTTP calls (consistent with other clients).
"""

import os
import logging
from typing import Optional

import httpx

from .base import LLMResponse, LLMProvider

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (as of January 2025)
ANTHROPIC_PRICING = {
    "claude-3-5-haiku-20241022": {"input": 1.00, "output": 5.00},
    "claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},
    "claude-3-opus-20240229": {"input": 15.00, "output": 75.00},
    "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
    "claude-3-sonnet-20240229": {"input": 3.00, "output": 15.00},
}


class AnthropicClient:
    """
    Client for Anthropic Claude API.

    Provides both async and sync methods for compatibility
    with different parts of the application.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 120.0
    ):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = model or os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")
        self.timeout = timeout
        self.base_url = "https://api.anthropic.com/v1"
        self.api_version = "2023-06-01"

    @property
    def provider_name(self) -> str:
        """Return provider identifier."""
        return LLMProvider.ANTHROPIC.value

    async def is_available(self) -> bool:
        """
        Check if Anthropic API is accessible.

        Returns True if API key is configured. Anthropic doesn't have
        a simple health endpoint, so we just check configuration.
        """
        return bool(self.api_key)

    def _calculate_cost(self, tokens_input: int, tokens_output: int) -> float:
        """Calculate estimated cost based on token usage."""
        pricing = ANTHROPIC_PRICING.get(self.model, {"input": 0, "output": 0})
        cost = (tokens_input * pricing["input"] + tokens_output * pricing["output"]) / 1_000_000
        return round(cost, 6)

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """
        Generate completion using Anthropic API.

        Args:
            prompt: User prompt/question
            temperature: Creativity level (0-1)
            max_tokens: Maximum tokens to generate
            system_prompt: Optional system context

        Returns:
            LLMResponse with content or error
        """
        if not self.api_key:
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Anthropic API key not configured",
                provider=self.provider_name
            )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                request_body = {
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}]
                }

                # Anthropic uses separate system parameter
                if system_prompt:
                    request_body["system"] = system_prompt

                response = await client.post(
                    f"{self.base_url}/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": self.api_version,
                        "content-type": "application/json"
                    },
                    json=request_body
                )

                if response.status_code == 429:
                    logger.warning("Anthropic rate limit exceeded")
                    return LLMResponse(
                        content="",
                        tokens_used=0,
                        model=self.model,
                        success=False,
                        error="Rate limit exceeded. Please try again later.",
                        provider=self.provider_name
                    )

                if response.status_code == 401:
                    logger.error("Anthropic authentication failed")
                    return LLMResponse(
                        content="",
                        tokens_used=0,
                        model=self.model,
                        success=False,
                        error="Invalid API key",
                        provider=self.provider_name
                    )

                if response.status_code != 200:
                    error_text = response.text[:200] if response.text else str(response.status_code)
                    logger.error(f"Anthropic API error: {response.status_code} - {error_text}")
                    return LLMResponse(
                        content="",
                        tokens_used=0,
                        model=self.model,
                        success=False,
                        error=f"Anthropic API error: {response.status_code}",
                        provider=self.provider_name
                    )

                result = response.json()

                # Anthropic returns content as array of blocks
                content_blocks = result.get("content", [])
                content = ""
                for block in content_blocks:
                    if block.get("type") == "text":
                        content += block.get("text", "")

                usage = result.get("usage", {})
                tokens_input = usage.get("input_tokens", 0)
                tokens_output = usage.get("output_tokens", 0)

                return LLMResponse(
                    content=content,
                    tokens_used=tokens_input + tokens_output,
                    model=self.model,
                    success=True,
                    provider=self.provider_name,
                    tokens_input=tokens_input,
                    tokens_output=tokens_output,
                    estimated_cost=self._calculate_cost(tokens_input, tokens_output)
                )

        except httpx.ConnectError:
            logger.error("Failed to connect to Anthropic API")
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Failed to connect to Anthropic API",
                provider=self.provider_name
            )
        except httpx.TimeoutException:
            logger.error("Anthropic request timed out")
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Request timed out",
                provider=self.provider_name
            )
        except Exception as e:
            logger.error(f"Unexpected error calling Anthropic: {e}")
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
        temperature: float = 0.3,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """
        Synchronous version of generate for non-async contexts.
        """
        if not self.api_key:
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Anthropic API key not configured",
                provider=self.provider_name
            )

        try:
            request_body = {
                "model": self.model,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}]
            }

            if system_prompt:
                request_body["system"] = system_prompt

            response = httpx.post(
                f"{self.base_url}/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": self.api_version,
                    "content-type": "application/json"
                },
                json=request_body,
                timeout=self.timeout
            )

            if response.status_code == 429:
                return LLMResponse(
                    content="",
                    tokens_used=0,
                    model=self.model,
                    success=False,
                    error="Rate limit exceeded",
                    provider=self.provider_name
                )

            if response.status_code != 200:
                return LLMResponse(
                    content="",
                    tokens_used=0,
                    model=self.model,
                    success=False,
                    error=f"Anthropic API error: {response.status_code}",
                    provider=self.provider_name
                )

            result = response.json()

            content_blocks = result.get("content", [])
            content = ""
            for block in content_blocks:
                if block.get("type") == "text":
                    content += block.get("text", "")

            usage = result.get("usage", {})
            tokens_input = usage.get("input_tokens", 0)
            tokens_output = usage.get("output_tokens", 0)

            return LLMResponse(
                content=content,
                tokens_used=tokens_input + tokens_output,
                model=self.model,
                success=True,
                provider=self.provider_name,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                estimated_cost=self._calculate_cost(tokens_input, tokens_output)
            )

        except httpx.ConnectError:
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Failed to connect to Anthropic API",
                provider=self.provider_name
            )
        except httpx.TimeoutException:
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Request timed out",
                provider=self.provider_name
            )
        except Exception as e:
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error=str(e),
                provider=self.provider_name
            )
