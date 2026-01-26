"""
AI Features Module for Made4Founders.

Provides:
- AI Business Assistant (natural language queries)
- Document Summarization
- Smart Deadline Extraction
- Competitor Monitoring
"""

from .llm_client import OllamaClient, generate_response
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
    "OllamaClient",
    "generate_response",
    "ASSISTANT_PROMPTS",
    "DOCUMENT_PROMPTS",
    "build_context",
    "DataContextBuilder",
    "extract_text_from_file",
    "summarize_document",
    "extract_deadlines_from_text",
    "extract_deadlines_smart",
    "detect_document_type",
    "CompetitorMonitor",
    "NewsAPIClient",
    "parse_rss_feed",
    "calculate_relevance_score",
    "detect_sentiment",
    "classify_update_type",
]
