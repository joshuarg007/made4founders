"""
Base classes and protocols for LLM providers.

Defines the common interface that all LLM providers must implement.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Protocol, runtime_checkable


class LLMProvider(str, Enum):
    """Available LLM providers."""
    OLLAMA = "ollama"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    CLOUDFLARE = "cloudflare"


@dataclass
class LLMResponse:
    """
    Response from any LLM provider.

    Extended from original to support multi-provider tracking and cost estimation.
    """
    content: str
    tokens_used: int
    model: str
    success: bool
    error: Optional[str] = None
    provider: str = ""
    tokens_input: int = 0
    tokens_output: int = 0
    estimated_cost: float = 0.0


@runtime_checkable
class LLMClientProtocol(Protocol):
    """
    Protocol that all LLM clients must implement.

    This ensures consistent interface across Ollama, OpenAI, and Anthropic clients.
    """

    @property
    def provider_name(self) -> str:
        """Return the provider identifier."""
        ...

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """Generate a response asynchronously."""
        ...

    def generate_sync(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None
    ) -> LLMResponse:
        """Generate a response synchronously."""
        ...

    async def is_available(self) -> bool:
        """Check if the provider is available and configured."""
        ...
