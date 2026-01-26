"""
LLM Providers Module.

Provides a unified interface for multiple LLM providers:
- Ollama (local, free)
- OpenAI (cloud)
- Anthropic (cloud)

Includes automatic fallback support for production reliability.
"""

from .base import LLMResponse, LLMProvider
from .factory import get_llm_client, get_fallback_client, FallbackLLMClient
from .openai_client import OpenAIClient
from .anthropic_client import AnthropicClient
from .cloudflare_client import CloudflareAIClient

__all__ = [
    "LLMResponse",
    "LLMProvider",
    "get_llm_client",
    "get_fallback_client",
    "FallbackLLMClient",
    "OpenAIClient",
    "AnthropicClient",
    "CloudflareAIClient",
]
