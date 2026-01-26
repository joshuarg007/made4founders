"""
OpenAI LLM Client.

Implements the LLMClientProtocol for OpenAI's API.
Uses httpx for async/sync HTTP calls (consistent with Ollama client).
"""

import os
import logging
from typing import Optional

import httpx

from .base import LLMResponse, LLMProvider

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (as of January 2025)
OPENAI_PRICING = {
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
}


class OpenAIClient:
    """
    Client for OpenAI API.

    Provides both async and sync methods for compatibility
    with different parts of the application.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 120.0
    ):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.timeout = timeout
        self.base_url = "https://api.openai.com/v1"

    @property
    def provider_name(self) -> str:
        """Return provider identifier."""
        return LLMProvider.OPENAI.value

    async def is_available(self) -> bool:
        """
        Check if OpenAI API is accessible.

        Returns True if API key is configured and we can reach the API.
        """
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                return response.status_code == 200
        except Exception as e:
            logger.debug(f"OpenAI availability check failed: {e}")
            return False

    def _calculate_cost(self, tokens_input: int, tokens_output: int) -> float:
        """Calculate estimated cost based on token usage."""
        pricing = OPENAI_PRICING.get(self.model, {"input": 0, "output": 0})
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
        Generate completion using OpenAI API.

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
                error="OpenAI API key not configured",
                provider=self.provider_name
            )

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens
                    }
                )

                if response.status_code == 429:
                    logger.warning("OpenAI rate limit exceeded")
                    return LLMResponse(
                        content="",
                        tokens_used=0,
                        model=self.model,
                        success=False,
                        error="Rate limit exceeded. Please try again later.",
                        provider=self.provider_name
                    )

                if response.status_code == 401:
                    logger.error("OpenAI authentication failed")
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
                    logger.error(f"OpenAI API error: {response.status_code} - {error_text}")
                    return LLMResponse(
                        content="",
                        tokens_used=0,
                        model=self.model,
                        success=False,
                        error=f"OpenAI API error: {response.status_code}",
                        provider=self.provider_name
                    )

                result = response.json()
                content = result["choices"][0]["message"]["content"]
                usage = result.get("usage", {})
                tokens_input = usage.get("prompt_tokens", 0)
                tokens_output = usage.get("completion_tokens", 0)

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
            logger.error("Failed to connect to OpenAI API")
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Failed to connect to OpenAI API",
                provider=self.provider_name
            )
        except httpx.TimeoutException:
            logger.error("OpenAI request timed out")
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Request timed out",
                provider=self.provider_name
            )
        except Exception as e:
            logger.error(f"Unexpected error calling OpenAI: {e}")
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
                error="OpenAI API key not configured",
                provider=self.provider_name
            )

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                },
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
                    error=f"OpenAI API error: {response.status_code}",
                    provider=self.provider_name
                )

            result = response.json()
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            tokens_input = usage.get("prompt_tokens", 0)
            tokens_output = usage.get("completion_tokens", 0)

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
                error="Failed to connect to OpenAI API",
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
