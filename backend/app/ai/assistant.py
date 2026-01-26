"""
AI Business Assistant.

Handles natural language queries about business data.
Uses Ollama for local LLM processing.
"""

import logging
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

from .llm_client import OllamaClient, parse_json_response, LLMResponse
from .prompts import ASSISTANT_SYSTEM_PROMPT, ASSISTANT_PROMPTS, detect_intent
from .data_context import build_context, format_context_for_prompt

logger = logging.getLogger(__name__)


class BusinessAssistant:
    """AI assistant for business queries."""

    def __init__(self, db: Session, organization_id: int, user_id: int):
        self.db = db
        self.organization_id = organization_id
        self.user_id = user_id
        self.client = OllamaClient()

    async def chat(
        self,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Process a user message and generate a response.

        Args:
            message: User's question/message
            conversation_history: Previous messages in this conversation

        Returns:
            Dict with response, data_cards, and suggested_actions
        """
        # Detect intent from message
        intent = detect_intent(message)
        logger.info(f"Detected intent: {intent} for message: {message[:50]}...")

        # Build relevant context
        context = build_context(self.db, self.organization_id, intent, message)
        context_str = format_context_for_prompt(context)

        # Build conversation context if available
        history_str = ""
        if conversation_history:
            history_parts = []
            for msg in conversation_history[-5:]:  # Last 5 messages
                role = msg.get("role", "user")
                content = msg.get("content", "")[:500]  # Limit length
                history_parts.append(f"{role.upper()}: {content}")
            if history_parts:
                history_str = "\nPREVIOUS CONVERSATION:\n" + "\n".join(history_parts) + "\n"

        # Select appropriate prompt template
        prompt_template = ASSISTANT_PROMPTS.get(intent, ASSISTANT_PROMPTS["general"])

        # Build the full prompt
        full_prompt = prompt_template.format(
            context=context_str + history_str,
            question=message
        )

        # Generate response
        response = await self.client.generate(
            prompt=full_prompt,
            system_prompt=ASSISTANT_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=2048
        )

        if not response.success:
            return {
                "response": f"I'm sorry, I couldn't process your request. {response.error or 'Please try again later.'}",
                "data_cards": [],
                "suggested_actions": [],
                "tokens_used": 0,
                "model": self.client.model,
                "intent": intent
            }

        # Parse the response
        parsed = parse_json_response(response.content)

        if parsed:
            return {
                "response": parsed.get("response", response.content),
                "data_cards": parsed.get("data_cards", []),
                "suggested_actions": parsed.get("suggested_actions", []),
                "tokens_used": response.tokens_used,
                "model": response.model,
                "intent": intent,
                "extra_data": {k: v for k, v in parsed.items()
                              if k not in ["response", "data_cards", "suggested_actions"]}
            }
        else:
            # If we couldn't parse JSON, return plain text response
            return {
                "response": response.content,
                "data_cards": [],
                "suggested_actions": self._generate_default_suggestions(intent),
                "tokens_used": response.tokens_used,
                "model": response.model,
                "intent": intent
            }

    def _generate_default_suggestions(self, intent: str) -> List[Dict[str, str]]:
        """Generate default suggestions based on intent."""
        suggestions_map = {
            "runway": [
                {"label": "View financial dashboard", "action": "navigate", "target": "/app/financial-dashboard"},
                {"label": "Check budget vs actual", "action": "query", "message": "How does my spending compare to budget?"},
            ],
            "revenue": [
                {"label": "View revenue dashboard", "action": "navigate", "target": "/app/revenue"},
                {"label": "Check churn rate", "action": "query", "message": "What's my current churn rate?"},
            ],
            "cap_table": [
                {"label": "View cap table", "action": "navigate", "target": "/app/cap-table"},
                {"label": "Model dilution", "action": "query", "message": "What would my dilution be if I raised $1M at $10M pre?"},
            ],
            "compliance": [
                {"label": "View checklist", "action": "navigate", "target": "/app/getting-started"},
                {"label": "Check deadlines", "action": "navigate", "target": "/app/deadlines"},
            ],
            "general": [
                {"label": "View dashboard", "action": "navigate", "target": "/app"},
                {"label": "Check metrics", "action": "navigate", "target": "/app/insights"},
            ]
        }
        return suggestions_map.get(intent, suggestions_map["general"])

    def get_suggestions(self, current_page: str = "") -> List[str]:
        """
        Get context-aware suggestions for the AI assistant.

        Args:
            current_page: Current page the user is on

        Returns:
            List of suggested questions
        """
        page_suggestions = {
            "/app": [
                "What's my runway?",
                "How is my MRR trending?",
                "What deadlines are coming up?",
                "Summarize my business health",
            ],
            "/app/financial-dashboard": [
                "What's my current burn rate?",
                "How long will my cash last?",
                "What are my biggest expenses?",
                "Compare to last month's spending",
            ],
            "/app/revenue": [
                "What's my MRR growth rate?",
                "How is my churn trending?",
                "Who are my top customers?",
                "Forecast next month's revenue",
            ],
            "/app/cap-table": [
                "What's my current ownership breakdown?",
                "How much have I raised?",
                "What's my option pool status?",
                "Model a $2M raise scenario",
            ],
            "/app/getting-started": [
                "What compliance items am I missing?",
                "What's my checklist progress?",
                "What should I focus on next?",
            ],
            "/app/budget": [
                "Am I on track with my budget?",
                "Which categories are over budget?",
                "Forecast my spending for this month",
            ],
            "/app/team": [
                "How many employees do I have?",
                "Who has PTO requests pending?",
                "Who's currently onboarding?",
            ],
        }

        # Get page-specific suggestions or defaults
        suggestions = page_suggestions.get(current_page, page_suggestions["/app"])

        return suggestions


async def process_chat_message(
    db: Session,
    organization_id: int,
    user_id: int,
    message: str,
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Convenience function to process a chat message.

    Args:
        db: Database session
        organization_id: User's organization
        user_id: User ID
        message: User's message
        conversation_history: Previous messages

    Returns:
        Assistant response dict
    """
    assistant = BusinessAssistant(db, organization_id, user_id)
    return await assistant.chat(message, conversation_history)


def get_context_suggestions(current_page: str = "") -> List[str]:
    """Get suggestions without database access."""
    assistant = BusinessAssistant.__new__(BusinessAssistant)
    return assistant.get_suggestions(current_page)
