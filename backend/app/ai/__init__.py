"""
AI Features Module for Made4Founders.

Provides:
- AI Business Assistant (natural language queries)
- Document Summarization
- Smart Deadline Extraction
- Competitor Monitoring
- Multi-provider LLM support (Ollama, OpenAI, Anthropic)
"""

from .llm_client import OllamaClient, LLMResponse, generate_response
from .providers import (
    LLMProvider,
    get_llm_client,
    get_fallback_client,
    FallbackLLMClient,
)
from .providers.openai_client import OpenAIClient
from .providers.anthropic_client import AnthropicClient
from .prompts import ASSISTANT_PROMPTS, DOCUMENT_PROMPTS
from .data_context import build_context, DataContextBuilder
from .document_ai import (
    extract_text_from_file,
    summarize_document,
    extract_deadlines_from_text,
    detect_document_type,
)
from .deadline_extractor import extract_deadlines_smart
from .competitor_monitor import (
    CompetitorMonitor,
    NewsAPIClient,
    parse_rss_feed,
    calculate_relevance_score,
    detect_sentiment,
    classify_update_type,
)

__all__ = [
    # LLM Clients
    "OllamaClient",
    "OpenAIClient",
    "AnthropicClient",
    "LLMResponse",
    "LLMProvider",
    "get_llm_client",
    "get_fallback_client",
    "FallbackLLMClient",
    "generate_response",
    # Prompts
    "ASSISTANT_PROMPTS",
    "DOCUMENT_PROMPTS",
    # Context
    "build_context",
    "DataContextBuilder",
    # Document AI
    "extract_text_from_file",
    "summarize_document",
    "extract_deadlines_from_text",
    "extract_deadlines_smart",
    "detect_document_type",
    # Competitor Monitoring
    "CompetitorMonitor",
    "NewsAPIClient",
    "parse_rss_feed",
    "calculate_relevance_score",
    "detect_sentiment",
    "classify_update_type",
]
