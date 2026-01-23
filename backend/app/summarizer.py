"""
AI Summarization for meeting transcripts using Claude Haiku.
Cost-effective approach: ~$0.001-0.01 per transcript.
"""

import os
import json
import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Try to import anthropic, but don't fail if not installed
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("anthropic package not installed. AI summarization will be disabled.")


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
    Generate AI summary of a meeting transcript using Claude Haiku.

    Args:
        transcript_text: The full transcript text
        max_chars: Maximum characters to send (truncate if longer)

    Returns:
        TranscriptSummary or None if API unavailable/error
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        logger.info("ANTHROPIC_API_KEY not set. Skipping AI summarization.")
        return None

    if not ANTHROPIC_AVAILABLE:
        logger.warning("anthropic package not available. Skipping AI summarization.")
        return None

    # Truncate if too long (to manage costs)
    if len(transcript_text) > max_chars:
        transcript_text = transcript_text[:max_chars] + "\n\n[Transcript truncated for summarization]"

    try:
        client = anthropic.Anthropic(api_key=api_key)

        message = client.messages.create(
            model="claude-3-haiku-20240307",  # Cheapest model
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": SUMMARIZE_PROMPT.format(transcript=transcript_text)
                }
            ]
        )

        # Parse response
        response_text = message.content[0].text.strip()

        # Try to extract JSON from response
        # Handle case where model might wrap in markdown code blocks
        if response_text.startswith("```"):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1])

        data = json.loads(response_text)

        return TranscriptSummary(
            summary=data.get("summary", ""),
            action_items=data.get("action_items", []),
            key_points=data.get("key_points", [])
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        return None
    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
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
