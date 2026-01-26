"""
Unified LLM Client for Ollama.

Provides a consistent interface for AI operations across the application.
Reuses patterns from the existing summarizer.py.

Note: For multi-provider support, see the providers/ module.
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List

import httpx

# Import from providers for backwards compatibility
from .providers.base import LLMResponse, LLMProvider

logger = logging.getLogger(__name__)

# Re-export LLMResponse for backwards compatibility
__all__ = ["LLMResponse", "OllamaClient", "parse_json_response", "generate_response"]


class OllamaClient:
    """Client for interacting with Ollama local LLM."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 120.0
    ):
        self.base_url = base_url or os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
        self.timeout = timeout

    @property
    def provider_name(self) -> str:
        """Return provider identifier."""
        return LLMProvider.OLLAMA.value

    async def is_available(self) -> bool:
        """
        Check if Ollama is running and accessible.

        Returns True if we can connect to the Ollama API.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """
        Generate a response from Ollama.

        Args:
            prompt: The user prompt
            temperature: Creativity level (0-1)
            max_tokens: Maximum tokens to generate
            system_prompt: Optional system prompt for context

        Returns:
            LLMResponse with content or error
        """
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": full_prompt,
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens
                        }
                    }
                )

                if response.status_code != 200:
                    logger.error(f"Ollama returned status {response.status_code}: {response.text}")
                    return LLMResponse(
                        content="",
                        tokens_used=0,
                        model=self.model,
                        success=False,
                        error=f"Ollama error: {response.status_code}",
                        provider=self.provider_name
                    )

                result = response.json()
                content = result.get("response", "").strip()
                tokens = result.get("eval_count", 0)

                return LLMResponse(
                    content=content,
                    tokens_used=tokens,
                    model=self.model,
                    success=True,
                    provider=self.provider_name,
                    tokens_output=tokens
                )

        except httpx.ConnectError:
            logger.info("Ollama not running or not accessible")
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Ollama not available. Please ensure Ollama is running.",
                provider=self.provider_name
            )
        except httpx.TimeoutException:
            logger.error("Ollama request timed out")
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Request timed out. Please try again.",
                provider=self.provider_name
            )
        except Exception as e:
            logger.error(f"Unexpected error in LLM call: {e}")
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
        Synchronous version of generate for use in non-async contexts.
        """
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        try:
            response = httpx.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                },
                timeout=self.timeout
            )

            if response.status_code != 200:
                return LLMResponse(
                    content="",
                    tokens_used=0,
                    model=self.model,
                    success=False,
                    error=f"Ollama error: {response.status_code}",
                    provider=self.provider_name
                )

            result = response.json()
            content = result.get("response", "").strip()
            tokens = result.get("eval_count", 0)

            return LLMResponse(
                content=content,
                tokens_used=tokens,
                model=self.model,
                success=True,
                provider=self.provider_name,
                tokens_output=tokens
            )

        except httpx.ConnectError:
            return LLMResponse(
                content="",
                tokens_used=0,
                model=self.model,
                success=False,
                error="Ollama not available",
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


def parse_json_response(content: str) -> Optional[Dict[str, Any]]:
    """
    Parse JSON from LLM response, handling common formatting issues.

    Args:
        content: Raw LLM response

    Returns:
        Parsed JSON dict or None
    """
    if not content:
        return None

    # Handle markdown code blocks
    if content.startswith("```"):
        lines = content.split('\n')
        end_idx = -1
        for i, line in enumerate(lines[1:], 1):
            if line.strip().startswith("```"):
                end_idx = i
                break
        if end_idx > 0:
            content = '\n'.join(lines[1:end_idx])
        else:
            content = '\n'.join(lines[1:])

    # Find JSON in response
    if not content.startswith("{") and not content.startswith("["):
        json_start = content.find("{")
        if json_start < 0:
            json_start = content.find("[")
        json_end = max(content.rfind("}"), content.rfind("]")) + 1
        if json_start >= 0 and json_end > json_start:
            content = content[json_start:json_end]

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {e}")
        logger.debug(f"Raw content: {content}")
        return None


# Convenience function for simple generation
async def generate_response(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 2048
) -> LLMResponse:
    """
    Quick helper to generate a response with default settings.
    """
    client = OllamaClient()
    return await client.generate(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens
    )
