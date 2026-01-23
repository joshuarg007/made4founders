"""
Transcript parser for VTT, SRT, and TXT files.
Extracts plain text, duration, word count, and speaker information.
"""

import re
from typing import Optional
from dataclasses import dataclass


@dataclass
class ParsedTranscript:
    """Result of parsing a transcript file."""
    text: str
    duration_seconds: Optional[int] = None
    word_count: int = 0
    speaker_count: int = 0
    speakers: list = None

    def __post_init__(self):
        if self.speakers is None:
            self.speakers = []


def parse_vtt(content: str) -> ParsedTranscript:
    """
    Parse WebVTT format.

    Example:
    WEBVTT

    00:00:00.000 --> 00:00:05.000
    Speaker 1: Hello everyone.

    00:00:05.000 --> 00:00:10.000
    Speaker 2: Hi there!
    """
    lines = content.strip().split('\n')
    text_lines = []
    speakers = set()
    last_timestamp = None

    # Skip WEBVTT header and any metadata
    i = 0
    while i < len(lines) and not re.match(r'\d{2}:\d{2}', lines[i]):
        i += 1

    while i < len(lines):
        line = lines[i].strip()

        # Check for timestamp line
        timestamp_match = re.match(
            r'(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})',
            line
        )
        if timestamp_match:
            last_timestamp = timestamp_match.group(2)
            i += 1
            continue

        # Skip cue identifiers (numeric lines before timestamps)
        if line.isdigit():
            i += 1
            continue

        # Skip empty lines
        if not line:
            i += 1
            continue

        # This is a text line
        # Check for speaker label (e.g., "Speaker 1:" or "John:")
        speaker_match = re.match(r'^([^:]+):\s*(.*)$', line)
        if speaker_match:
            speaker = speaker_match.group(1).strip()
            text = speaker_match.group(2).strip()
            speakers.add(speaker)
            if text:
                text_lines.append(f"{speaker}: {text}")
        else:
            text_lines.append(line)

        i += 1

    # Calculate duration from last timestamp
    duration = None
    if last_timestamp:
        duration = parse_timestamp(last_timestamp)

    full_text = '\n'.join(text_lines)
    word_count = len(full_text.split())

    return ParsedTranscript(
        text=full_text,
        duration_seconds=duration,
        word_count=word_count,
        speaker_count=len(speakers),
        speakers=list(speakers)
    )


def parse_srt(content: str) -> ParsedTranscript:
    """
    Parse SubRip (SRT) format.

    Example:
    1
    00:00:00,000 --> 00:00:05,000
    Hello everyone.

    2
    00:00:05,000 --> 00:00:10,000
    Hi there!
    """
    lines = content.strip().split('\n')
    text_lines = []
    speakers = set()
    last_timestamp = None

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Skip sequence numbers
        if line.isdigit():
            i += 1
            continue

        # Check for timestamp line
        timestamp_match = re.match(
            r'(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})',
            line
        )
        if timestamp_match:
            last_timestamp = timestamp_match.group(2)
            i += 1
            continue

        # Skip empty lines
        if not line:
            i += 1
            continue

        # This is a text line - strip HTML tags if present
        line = re.sub(r'<[^>]+>', '', line)

        # Check for speaker label
        speaker_match = re.match(r'^([^:]+):\s*(.*)$', line)
        if speaker_match:
            speaker = speaker_match.group(1).strip()
            text = speaker_match.group(2).strip()
            speakers.add(speaker)
            if text:
                text_lines.append(f"{speaker}: {text}")
        else:
            text_lines.append(line)

        i += 1

    # Calculate duration from last timestamp
    duration = None
    if last_timestamp:
        duration = parse_timestamp(last_timestamp)

    full_text = '\n'.join(text_lines)
    word_count = len(full_text.split())

    return ParsedTranscript(
        text=full_text,
        duration_seconds=duration,
        word_count=word_count,
        speaker_count=len(speakers),
        speakers=list(speakers)
    )


def parse_txt(content: str) -> ParsedTranscript:
    """
    Parse plain text transcript.
    Attempts to detect speakers from common patterns.
    """
    lines = content.strip().split('\n')
    speakers = set()

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check for speaker patterns
        # Pattern: "Speaker Name:" or "[Speaker Name]" or "(Speaker Name)"
        speaker_patterns = [
            r'^([^:]+):\s',           # Name:
            r'^\[([^\]]+)\]\s',       # [Name]
            r'^\(([^)]+)\)\s',        # (Name)
        ]

        for pattern in speaker_patterns:
            match = re.match(pattern, line)
            if match:
                speaker = match.group(1).strip()
                # Filter out timestamps that might look like speakers
                if not re.match(r'\d{1,2}:\d{2}', speaker):
                    speakers.add(speaker)
                break

    full_text = content.strip()
    word_count = len(full_text.split())

    return ParsedTranscript(
        text=full_text,
        duration_seconds=None,  # Can't determine from plain text
        word_count=word_count,
        speaker_count=len(speakers),
        speakers=list(speakers)
    )


def parse_timestamp(timestamp: str) -> int:
    """
    Parse a timestamp string to seconds.
    Handles formats: HH:MM:SS,mmm or HH:MM:SS.mmm
    """
    # Normalize comma to period
    timestamp = timestamp.replace(',', '.')

    parts = timestamp.split(':')
    if len(parts) == 3:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return int(hours * 3600 + minutes * 60 + seconds)
    elif len(parts) == 2:
        minutes = int(parts[0])
        seconds = float(parts[1])
        return int(minutes * 60 + seconds)

    return 0


def parse_transcript(content: str, file_format: str) -> ParsedTranscript:
    """
    Parse a transcript file based on its format.

    Args:
        content: The file content as a string
        file_format: One of 'vtt', 'srt', 'txt'

    Returns:
        ParsedTranscript with extracted data
    """
    file_format = file_format.lower().strip('.')

    if file_format == 'vtt':
        return parse_vtt(content)
    elif file_format == 'srt':
        return parse_srt(content)
    else:
        return parse_txt(content)
