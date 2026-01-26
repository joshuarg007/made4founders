"""
Smart Deadline Extraction Module.

Extracts dates, deadlines, and recurring schedules from documents.
Uses a combination of regex patterns, dateparser, and AI analysis.
"""

import re
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


# Deadline context keywords
DEADLINE_KEYWORDS = [
    'due', 'deadline', 'expires', 'expiration', 'expiring',
    'must be', 'required by', 'submit by', 'file by', 'pay by',
    'no later than', 'before', 'by the end of', 'within',
    'effective', 'starting', 'begins', 'commences',
    'renewal', 'renew by', 'extend by',
]

# Recurring schedule patterns
RECURRING_PATTERNS = {
    'weekly': ['weekly', 'every week', 'each week'],
    'monthly': ['monthly', 'every month', 'each month', 'per month'],
    'quarterly': ['quarterly', 'every quarter', 'each quarter', 'q1', 'q2', 'q3', 'q4'],
    'annually': ['annually', 'yearly', 'every year', 'each year', 'annual'],
}


def extract_deadlines_smart(
    text: str,
    reference_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Extract deadlines from text using smart analysis.

    Args:
        text: Document text
        reference_date: Reference date for relative dates (defaults to today)

    Returns:
        Dict with deadlines and recurring_dates
    """
    if reference_date is None:
        reference_date = datetime.now()

    deadlines = []
    recurring = []

    # Extract using dateparser if available
    try:
        import dateparser
        has_dateparser = True
    except ImportError:
        has_dateparser = False
        logger.warning("dateparser not installed, using basic extraction")

    # Split into sentences for context
    sentences = re.split(r'[.!?]\s+', text)

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Check if sentence contains deadline keywords
        has_deadline_keyword = any(kw in sentence.lower() for kw in DEADLINE_KEYWORDS)

        # Check for recurring patterns
        for frequency, patterns in RECURRING_PATTERNS.items():
            if any(p in sentence.lower() for p in patterns):
                recurring_item = extract_recurring_from_sentence(sentence, frequency)
                if recurring_item:
                    recurring.append(recurring_item)

        # Extract dates from sentence
        if has_dateparser:
            dates_in_sentence = extract_dates_dateparser(sentence, reference_date)
        else:
            dates_in_sentence = extract_dates_basic(sentence, reference_date)

        for date_info in dates_in_sentence:
            deadline = {
                "title": generate_deadline_title(sentence),
                "date": date_info["date"],
                "type": classify_deadline_type(sentence),
                "requires_action": has_deadline_keyword,
                "action_description": extract_action(sentence) if has_deadline_keyword else None,
                "confidence": date_info.get("confidence", "medium"),
                "source_text": sentence[:200]
            }
            deadlines.append(deadline)

    # Deduplicate by date
    seen_dates = set()
    unique_deadlines = []
    for d in deadlines:
        if d["date"] not in seen_dates:
            seen_dates.add(d["date"])
            unique_deadlines.append(d)

    return {
        "deadlines": unique_deadlines,
        "recurring_dates": recurring
    }


def extract_dates_dateparser(
    text: str,
    reference_date: datetime
) -> List[Dict[str, Any]]:
    """
    Extract dates using dateparser library.
    """
    import dateparser

    dates = []

    # Common date patterns to look for
    patterns = [
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',  # MM/DD/YYYY or DD/MM/YYYY
        r'\b\d{4}[/-]\d{2}[/-]\d{2}\b',  # YYYY-MM-DD
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b',  # Month DD, YYYY
        r'\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b',  # DD Month YYYY
    ]

    for pattern in patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            date_str = match.group()
            parsed = dateparser.parse(
                date_str,
                settings={
                    'RELATIVE_BASE': reference_date,
                    'PREFER_DATES_FROM': 'future'
                }
            )
            if parsed:
                dates.append({
                    "date": parsed.strftime('%Y-%m-%d'),
                    "confidence": "high"
                })

    # Also try to parse relative dates
    relative_patterns = [
        (r'next\s+(\w+)', 'relative'),
        (r'in\s+(\d+)\s+(days?|weeks?|months?|years?)', 'relative'),
        (r'within\s+(\d+)\s+(days?|weeks?|months?)', 'relative'),
    ]

    for pattern, _ in relative_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            parsed = dateparser.parse(
                match.group(),
                settings={
                    'RELATIVE_BASE': reference_date,
                    'PREFER_DATES_FROM': 'future'
                }
            )
            if parsed:
                dates.append({
                    "date": parsed.strftime('%Y-%m-%d'),
                    "confidence": "medium"
                })

    return dates


def extract_dates_basic(
    text: str,
    reference_date: datetime
) -> List[Dict[str, Any]]:
    """
    Basic date extraction without dateparser.
    """
    dates = []

    # ISO format
    iso_matches = re.finditer(r'\b(\d{4})-(\d{2})-(\d{2})\b', text)
    for match in iso_matches:
        try:
            year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
            date_obj = datetime(year, month, day)
            dates.append({
                "date": date_obj.strftime('%Y-%m-%d'),
                "confidence": "high"
            })
        except ValueError:
            continue

    # US format MM/DD/YYYY
    us_matches = re.finditer(r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b', text)
    for match in us_matches:
        try:
            month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            date_obj = datetime(year, month, day)
            dates.append({
                "date": date_obj.strftime('%Y-%m-%d'),
                "confidence": "medium"
            })
        except ValueError:
            continue

    return dates


def extract_recurring_from_sentence(
    sentence: str,
    frequency: str
) -> Optional[Dict[str, Any]]:
    """
    Extract recurring schedule information from a sentence.
    """
    # Try to find what the recurring item is about
    title = generate_deadline_title(sentence)

    # Try to find the next occurrence
    next_date = None

    # Look for specific dates in the sentence
    dates = extract_dates_basic(sentence, datetime.now())
    if dates:
        next_date = dates[0]["date"]

    return {
        "title": title,
        "frequency": frequency,
        "next_date": next_date,
        "description": sentence[:150]
    }


def classify_deadline_type(text: str) -> str:
    """
    Classify the type of deadline based on context.
    """
    text_lower = text.lower()

    if any(w in text_lower for w in ['expir', 'renewal', 'renew']):
        return 'expiration'
    if any(w in text_lower for w in ['effective', 'start', 'begin', 'commence']):
        return 'effective_date'
    if any(w in text_lower for w in ['file', 'submit', 'tax', 'compliance', 'regulatory']):
        return 'deadline'
    if any(w in text_lower for w in ['milestone', 'target', 'goal']):
        return 'milestone'
    if any(w in text_lower for w in ['pay', 'payment', 'due']):
        return 'payment'

    return 'deadline'


def generate_deadline_title(sentence: str) -> str:
    """
    Generate a concise title from the sentence.
    """
    # Remove common filler words and truncate
    sentence = sentence.strip()

    # Try to extract the main subject
    # Simple approach: take first few meaningful words

    # Remove leading articles and conjunctions
    words = sentence.split()
    skip_words = {'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'for'}
    meaningful_words = [w for w in words[:8] if w.lower() not in skip_words]

    title = ' '.join(meaningful_words[:5])

    # Clean up
    title = re.sub(r'[^\w\s-]', '', title)
    title = title.strip()

    if len(title) > 50:
        title = title[:47] + '...'

    return title or 'Deadline'


def extract_action(sentence: str) -> Optional[str]:
    """
    Extract the action that needs to be taken.
    """
    # Look for verb phrases after deadline keywords
    action_patterns = [
        r'must\s+(.+?)(?:\.|$)',
        r'need\s+to\s+(.+?)(?:\.|$)',
        r'required\s+to\s+(.+?)(?:\.|$)',
        r'should\s+(.+?)(?:\.|$)',
    ]

    for pattern in action_patterns:
        match = re.search(pattern, sentence, re.IGNORECASE)
        if match:
            action = match.group(1).strip()
            if len(action) > 10:
                return action[:100]

    return None


def validate_deadline(deadline: Dict[str, Any]) -> bool:
    """
    Validate that a deadline is reasonable.
    """
    try:
        date = datetime.strptime(deadline["date"], '%Y-%m-%d')

        # Date should be within reasonable range (not too far in past or future)
        now = datetime.now()
        min_date = now - timedelta(days=365 * 2)  # 2 years ago
        max_date = now + timedelta(days=365 * 5)  # 5 years from now

        if date < min_date or date > max_date:
            return False

        return True

    except (ValueError, KeyError):
        return False
