"""
LLM Client Factory.

Provides a unified interface to get LLM clients with fallback support.
"""

import os
import logging
from typing import Optional, List, Union

from .base import LLMResponse, LLMProvider
from .openai_client import OpenAIClient
from .anthropic_client import AnthropicClient
from .cloudflare_client import CloudflareAIClient

logger = logging.getLogger(__name__)

# Default fallback order: try local first (free), then free cloud, then paid cloud
DEFAULT_FALLBACK_ORDER = [
    LLMProvider.OLLAMA,
    LLMProvider.CLOUDFLARE,
    LLMProvider.OPENAI,
    LLMProvider.ANTHROPIC
]


def get_provider_preference(db, organization_id: int) -> Optional[str]:
    """
    Get organization's preferred LLM provider from settings.

    Args:
        db: Database session
        organization_id: Organization ID

    Returns:
        Provider name or None if not set
    """
    # Import here to avoid circular dependency
    from ...models import Organization

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if org and org.settings:
        return org.settings.get("llm_provider")
    return None


def get_llm_client(
    provider: Optional[str] = None,
    db=None,
    organization_id: Optional[int] = None
):
    """
    Get an LLM client for the specified provider.

    Args:
        provider: Provider name (ollama, openai, anthropic). If None, uses preference.
        db: Database session for loading org preferences
        organization_id: Organization ID for preferences

    Returns:
        LLM client instance
    """
    # Import OllamaClient here to avoid circular dependency
    from ..llm_client import OllamaClient

    # Determine provider
    if not provider and db and organization_id:
        provider = get_provider_preference(db, organization_id)

    provider = provider or LLMProvider.OLLAMA.value

    if provider == LLMProvider.CLOUDFLARE.value:
        return CloudflareAIClient()
    elif provider == LLMProvider.OPENAI.value:
        return OpenAIClient()
    elif provider == LLMProvider.ANTHROPIC.value:
        return AnthropicClient()
    else:
        return OllamaClient()


class FallbackLLMClient:
    """
    LLM client with automatic fallback between providers.

    Tries providers in order until one succeeds.
    """

    def __init__(
        self,
        preferred_provider: Optional[str] = None,
        fallback_order: Optional[List[str]] = None,
        prefer_local: bool = True
    ):
        """
        Initialize fallback client.

        Args:
            preferred_provider: Provider to try first
            fallback_order: Order to try providers
            prefer_local: Whether to always try Ollama first (cost savings)
        """
        self.preferred_provider = preferred_provider
        self.fallback_order = fallback_order or [p.value for p in DEFAULT_FALLBACK_ORDER]
        self.prefer_local = prefer_local

        # If prefer_local and Ollama not first, move it to front
        if prefer_local and LLMProvider.OLLAMA.value in self.fallback_order:
            self.fallback_order = [
                p for p in self.fallback_order
                if p != LLMProvider.OLLAMA.value
            ]
            self.fallback_order.insert(0, LLMProvider.OLLAMA.value)

        # If preferred provider specified, move to front (after local if prefer_local)
        if preferred_provider and preferred_provider in self.fallback_order:
            self.fallback_order = [
                p for p in self.fallback_order
                if p != preferred_provider
            ]
            insert_pos = 1 if prefer_local and LLMProvider.OLLAMA.value == self.fallback_order[0] else 0
            self.fallback_order.insert(insert_pos, preferred_provider)

    @property
    def provider_name(self) -> str:
        """Return fallback identifier."""
        return "fallback"

    def _get_clients(self) -> List:
        """Get client instances in fallback order."""
        # Import here to avoid circular dependency
        from ..llm_client import OllamaClient

        clients = []
        for provider in self.fallback_order:
            if provider == LLMProvider.OLLAMA.value:
                clients.append(OllamaClient())
            elif provider == LLMProvider.CLOUDFLARE.value:
                clients.append(CloudflareAIClient())
            elif provider == LLMProvider.OPENAI.value:
                clients.append(OpenAIClient())
            elif provider == LLMProvider.ANTHROPIC.value:
                clients.append(AnthropicClient())
        return clients

    async def is_available(self) -> bool:
        """Check if any provider is available."""
        for client in self._get_clients():
            if await client.is_available():
                return True
        return False

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """
        Try each provider in order until one succeeds.

        Args:
            prompt: User prompt/question
            temperature: Creativity level (0-1)
            max_tokens: Maximum tokens to generate
            system_prompt: Optional system context

        Returns:
            LLMResponse from first successful provider
        """
        last_error = None
        tried_providers = []

        for client in self._get_clients():
            provider_name = getattr(client, 'provider_name', 'unknown')
            tried_providers.append(provider_name)

            try:
                response = await client.generate(
                    prompt=prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    system_prompt=system_prompt
                )

                if response.success:
                    logger.info(f"LLM request succeeded with provider: {provider_name}")
                    return response
                else:
                    last_error = response.error
                    logger.warning(f"Provider {provider_name} failed: {response.error}")

            except Exception as e:
                last_error = str(e)
                logger.warning(f"Provider {provider_name} exception: {e}")

        # All providers failed
        return LLMResponse(
            content="",
            tokens_used=0,
            model="",
            success=False,
            error=f"All LLM providers failed ({', '.join(tried_providers)}). Last error: {last_error}",
            provider="none"
        )

    def generate_sync(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """
        Synchronous version with fallback.
        """
        last_error = None
        tried_providers = []

        for client in self._get_clients():
            provider_name = getattr(client, 'provider_name', 'unknown')
            tried_providers.append(provider_name)

            try:
                response = client.generate_sync(
                    prompt=prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    system_prompt=system_prompt
                )

                if response.success:
                    logger.info(f"LLM request succeeded with provider: {provider_name}")
                    return response
                else:
                    last_error = response.error
                    logger.warning(f"Provider {provider_name} failed: {response.error}")

            except Exception as e:
                last_error = str(e)
                logger.warning(f"Provider {provider_name} exception: {e}")

        # All providers failed
        return LLMResponse(
            content="",
            tokens_used=0,
            model="",
            success=False,
            error=f"All LLM providers failed ({', '.join(tried_providers)}). Last error: {last_error}",
            provider="none"
        )


def get_fallback_client(
    db=None,
    organization_id: Optional[int] = None,
    prefer_local: bool = True
) -> FallbackLLMClient:
    """
    Factory function to create a FallbackLLMClient with org preferences.

    Args:
        db: Database session
        organization_id: Organization ID for preferences
        prefer_local: Whether to always try Ollama first (cost savings)

    Returns:
        Configured FallbackLLMClient
    """
    preferred = None
    if db and organization_id:
        preferred = get_provider_preference(db, organization_id)

    return FallbackLLMClient(
        preferred_provider=preferred,
        prefer_local=prefer_local
    )
