"""
AI Summarization for meeting transcripts using Ollama (local LLM).
Cost-effective approach: runs locally, no API costs.
"""

import os
import json
import logging
from typing import Optional
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


@dataclass
class TranscriptSummary:
    """Result of AI summarization."""
    summary: str
    action_items: list
    key_points: list


SUMMARIZE_PROMPT = """Analyze this meeting transcript and provide:

1. A 2-3 sentence summary of what was discussed
2. A list of action items (tasks that need to be done, with who is responsible if mentioned)
3. A list of key decisions or important points

Transcript:
{transcript}

Respond in this exact JSON format:
{{
    "summary": "2-3 sentence summary here",
    "action_items": ["action item 1", "action item 2"],
    "key_points": ["key point 1", "key point 2"]
}}

If there are no action items or key points, use empty arrays.
Only respond with the JSON, no other text."""


def summarize_transcript(transcript_text: str, max_chars: int = 50000) -> Optional[TranscriptSummary]:
    """
    Generate AI summary of a meeting transcript using Ollama (local LLM).

    Args:
        transcript_text: The full transcript text
        max_chars: Maximum characters to send (truncate if longer)

    Returns:
        TranscriptSummary or None if Ollama unavailable/error
    """
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

    # Truncate if too long (to manage memory)
    if len(transcript_text) > max_chars:
        transcript_text = transcript_text[:max_chars] + "\n\n[Transcript truncated for summarization]"

    try:
        response = httpx.post(
            f"{ollama_url}/api/generate",
            json={
                "model": ollama_model,
                "prompt": SUMMARIZE_PROMPT.format(transcript=transcript_text),
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 1024
                }
            },
            timeout=120.0  # Ollama can be slow on first run
        )

        if response.status_code != 200:
            logger.error(f"Ollama returned status {response.status_code}: {response.text}")
            return None

        result = response.json()
        response_text = result.get("response", "").strip()

        if not response_text:
            logger.warning("Ollama returned empty response")
            return None

        # Try to extract JSON from response
        # Handle case where model might wrap in markdown code blocks
        if response_text.startswith("```"):
            lines = response_text.split('\n')
            # Find the closing ```
            end_idx = -1
            for i, line in enumerate(lines[1:], 1):
                if line.strip().startswith("```"):
                    end_idx = i
                    break
            if end_idx > 0:
                response_text = '\n'.join(lines[1:end_idx])
            else:
                response_text = '\n'.join(lines[1:])

        # Try to find JSON in the response if not already JSON
        if not response_text.startswith("{"):
            # Look for JSON object in the response
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                response_text = response_text[json_start:json_end]

        data = json.loads(response_text)

        return TranscriptSummary(
            summary=data.get("summary", ""),
            action_items=data.get("action_items", []),
            key_points=data.get("key_points", [])
        )

    except httpx.ConnectError:
        logger.info("Ollama not running or not accessible. Skipping AI summarization.")
        return None
    except httpx.TimeoutException:
        logger.error("Ollama request timed out")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Ollama response as JSON: {e}")
        logger.debug(f"Raw response: {response_text}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in summarization: {e}")
        return None


def format_summary_for_display(summary: TranscriptSummary) -> str:
    """
    Format a TranscriptSummary for display as markdown.
    """
    parts = [summary.summary, ""]

    if summary.action_items:
        parts.append("**Action Items:**")
        for item in summary.action_items:
            parts.append(f"- {item}")
        parts.append("")

    if summary.key_points:
        parts.append("**Key Points:**")
        for point in summary.key_points:
            parts.append(f"- {point}")

    return '\n'.join(parts)
