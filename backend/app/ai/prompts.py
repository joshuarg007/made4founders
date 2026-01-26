"""
Prompt templates for AI features.

All prompts are designed to return structured JSON for consistent parsing.
"""

# =============================================================================
# SYSTEM PROMPTS
# =============================================================================

ASSISTANT_SYSTEM_PROMPT = """You are an AI business assistant for a startup founder.
You help analyze business metrics, financial data, and provide actionable insights.

Key responsibilities:
- Answer questions about business metrics (MRR, ARR, runway, burn rate, etc.)
- Provide insights from financial data
- Help with cap table and equity questions
- Assist with compliance and deadline tracking
- Give practical, founder-focused advice

Always be:
- Concise and direct
- Data-driven when data is available
- Honest about limitations
- Practical and actionable

When you don't have data to answer a question, say so clearly and suggest how the user can get that information."""

# =============================================================================
# ASSISTANT PROMPTS
# =============================================================================

ASSISTANT_PROMPTS = {
    "general": """Based on the following business context, answer the user's question.

BUSINESS CONTEXT:
{context}

USER QUESTION: {question}

Provide a helpful, concise response. If you reference specific data, mention the source.
If you can't answer with the available data, explain what data would be needed.

Respond in this JSON format:
{{
    "response": "Your answer here",
    "data_cards": [
        {{
            "type": "metric",
            "title": "Metric Name",
            "value": "Value",
            "trend": "up|down|stable|null"
        }}
    ],
    "suggested_actions": [
        {{
            "label": "Action label",
            "action": "navigate|query",
            "target": "/path or follow-up question"
        }}
    ]
}}

data_cards should include relevant metrics or data visualizations when applicable.
suggested_actions should include helpful follow-up actions.
If no data cards or actions are relevant, use empty arrays.""",

    "runway": """Analyze the financial runway based on the following data:

FINANCIAL DATA:
{context}

Calculate and explain:
1. Current runway in months
2. Monthly burn rate and trend
3. Key factors affecting runway
4. Recommendations if runway is concerning

Respond in JSON format:
{{
    "response": "Analysis summary",
    "runway_months": number,
    "burn_rate": number,
    "burn_trend": "increasing|decreasing|stable",
    "data_cards": [...],
    "recommendations": ["recommendation 1", "recommendation 2"]
}}""",

    "revenue": """Analyze the revenue metrics based on the following data:

REVENUE DATA:
{context}

Provide insights on:
1. Current MRR/ARR
2. Growth rate
3. Churn analysis
4. Revenue trends

Respond in JSON format:
{{
    "response": "Revenue analysis summary",
    "mrr": number,
    "arr": number,
    "growth_rate": number,
    "churn_rate": number,
    "data_cards": [...],
    "insights": ["insight 1", "insight 2"]
}}""",

    "cap_table": """Analyze the cap table based on the following data:

CAP TABLE DATA:
{context}

Provide insights on:
1. Ownership breakdown
2. Dilution analysis
3. Option pool status
4. Key concerns or opportunities

Respond in JSON format:
{{
    "response": "Cap table analysis",
    "founder_ownership": number,
    "investor_ownership": number,
    "employee_pool": number,
    "data_cards": [...],
    "insights": ["insight 1"]
}}""",

    "compliance": """Review the compliance status based on the following data:

COMPLIANCE DATA:
{context}

Identify:
1. Upcoming deadlines
2. Missing or incomplete items
3. Priority actions needed
4. Risk areas

Respond in JSON format:
{{
    "response": "Compliance status summary",
    "upcoming_deadlines": [
        {{"name": "...", "due_date": "YYYY-MM-DD", "priority": "high|medium|low"}}
    ],
    "missing_items": ["item 1"],
    "data_cards": [...],
    "priority_actions": ["action 1"]
}}"""
}

# =============================================================================
# DOCUMENT PROMPTS
# =============================================================================

DOCUMENT_PROMPTS = {
    "summarize": """Analyze and summarize the following document:

DOCUMENT CONTENT:
{content}

Provide:
1. A concise summary (2-3 paragraphs)
2. Key terms and their values (for contracts, agreements, etc.)
3. Any dates or deadlines mentioned
4. Potential risk flags or important notes

Respond in JSON format:
{{
    "summary": "Document summary here",
    "document_type": "contract|term_sheet|invoice|report|legal|other",
    "key_terms": [
        {{"term": "Term Name", "value": "Value or description"}}
    ],
    "dates": [
        {{"description": "What this date is for", "date": "YYYY-MM-DD"}}
    ],
    "risk_flags": ["Any concerning clauses or issues"],
    "action_items": ["Suggested actions based on document"]
}}""",

    "extract_deadlines": """Extract all dates and deadlines from the following document:

DOCUMENT CONTENT:
{content}

For each date found, identify:
1. What the date refers to
2. Whether it's a deadline, milestone, or informational date
3. If it requires any action
4. Confidence level (high/medium/low)

Respond in JSON format:
{{
    "deadlines": [
        {{
            "title": "Brief description of deadline",
            "date": "YYYY-MM-DD",
            "type": "deadline|milestone|effective_date|expiration|recurring",
            "requires_action": true|false,
            "action_description": "What needs to be done (if applicable)",
            "confidence": "high|medium|low",
            "source_text": "Exact text from document mentioning this date"
        }}
    ],
    "recurring_dates": [
        {{
            "title": "Description",
            "frequency": "weekly|monthly|quarterly|annually",
            "next_date": "YYYY-MM-DD"
        }}
    ]
}}"""
}

# =============================================================================
# COMPETITOR PROMPTS
# =============================================================================

COMPETITOR_PROMPTS = {
    "analyze_news": """Analyze the following news articles about a competitor:

COMPETITOR: {competitor_name}
YOUR COMPANY FOCUS: {user_focus}

NEWS ARTICLES:
{articles}

Provide:
1. Summary of key developments
2. Relevance to the user's business
3. Sentiment analysis
4. Strategic implications

Respond in JSON format:
{{
    "summary": "Overall summary of competitor activity",
    "key_developments": [
        {{
            "title": "Development title",
            "description": "Brief description",
            "relevance_score": 0.0-1.0,
            "sentiment": "positive|neutral|negative",
            "implications": "How this might affect user's business"
        }}
    ],
    "recommended_actions": ["action 1"],
    "overall_threat_level": "low|medium|high"
}}""",

    "weekly_digest": """Create a weekly digest of competitor activity:

COMPETITORS:
{competitors}

UPDATES THIS WEEK:
{updates}

Create a concise weekly summary highlighting:
1. Most important developments
2. Market trends
3. Recommended responses

Respond in JSON format:
{{
    "digest_summary": "Executive summary",
    "top_developments": [
        {{
            "competitor": "Name",
            "development": "What happened",
            "importance": "high|medium|low"
        }}
    ],
    "market_trends": ["trend 1"],
    "action_items": ["action 1"]
}}"""
}

# =============================================================================
# MEETING TRANSCRIPT PROMPTS
# =============================================================================

TRANSCRIPT_PROMPTS = {
    "extract_action_items": """Analyze this meeting transcript and extract action items:

TRANSCRIPT:
{transcript}

For each action item, identify:
1. The task that needs to be done
2. Who is responsible (if mentioned)
3. Due date or timeframe (if mentioned)
4. Priority level based on context

Respond in JSON format:
{{
    "action_items": [
        {{
            "task": "Description of what needs to be done",
            "assignee": "Person responsible (or 'Unassigned')",
            "due_date": "YYYY-MM-DD or null",
            "due_description": "Next week, by Friday, etc.",
            "priority": "high|medium|low",
            "context": "Brief context from the meeting"
        }}
    ]
}}""",

    "extract_decisions": """Analyze this meeting transcript and extract key decisions:

TRANSCRIPT:
{transcript}

Identify all decisions made during the meeting, including:
1. What was decided
2. Who made or approved the decision
3. Any conditions or caveats
4. Follow-up actions required

Respond in JSON format:
{{
    "decisions": [
        {{
            "decision": "What was decided",
            "made_by": "Who decided (if mentioned)",
            "rationale": "Why this decision was made",
            "conditions": ["Any conditions or caveats"],
            "follow_ups": ["Required follow-up actions"]
        }}
    ]
}}""",

    "speaker_analysis": """Analyze speaker participation in this meeting transcript:

TRANSCRIPT:
{transcript}

Provide analysis of:
1. Each speaker's participation time/percentage
2. Topics each speaker focused on
3. Meeting dynamics observations

Respond in JSON format:
{{
    "speakers": [
        {{
            "name": "Speaker name",
            "word_count": number,
            "percentage": number,
            "main_topics": ["topic 1", "topic 2"],
            "sentiment": "positive|neutral|negative"
        }}
    ],
    "meeting_dynamics": "Brief observation about meeting dynamics",
    "suggestions": ["Suggestion for better meetings"]
}}"""
}

# =============================================================================
# INTENT DETECTION
# =============================================================================

INTENT_PATTERNS = {
    "runway": ["runway", "how long", "cash last", "burn rate", "months left", "money left"],
    "revenue": ["mrr", "arr", "revenue", "sales", "subscriptions", "income", "earnings"],
    "cap_table": ["cap table", "dilution", "equity", "shareholders", "ownership", "stock", "options", "shares"],
    "compliance": ["compliance", "checklist", "filing", "deadline", "due date", "regulatory", "legal"],
    "investor": ["investor", "update", "fundraising", "data room", "pitch", "raise"],
    "budget": ["budget", "spending", "expenses", "costs", "forecast"],
    "team": ["team", "employee", "hire", "headcount", "pto", "onboarding"],
    "general": []  # Fallback
}


def detect_intent(query: str) -> str:
    """
    Detect the intent of a user query based on keywords.

    Args:
        query: The user's question

    Returns:
        Intent category string
    """
    query_lower = query.lower()

    for intent, patterns in INTENT_PATTERNS.items():
        if intent == "general":
            continue
        for pattern in patterns:
            if pattern in query_lower:
                return intent

    return "general"
