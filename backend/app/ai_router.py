"""
AI Features API Router.

Provides endpoints for:
- AI Business Assistant (chat)
- Document Summarization
- Deadline Extraction
- Competitor Monitoring
"""

import logging
import os
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .database import get_db
from .auth import get_current_user
from .models import (
    User, Organization, AIConversation, AIMessage,
    Competitor, CompetitorUpdate, DocumentSummary, Document,
    MeetingTranscript, Task, TaskBoard, TaskColumn, LLMUsage
)
from .schemas import (
    AIChatRequest, AIChatResponse, AIMessageResponse,
    AIConversationResponse, AIConversationListItem, AISuggestionsResponse,
    DocumentSummaryResponse, DeadlineExtractionResponse,
    CompetitorCreate, CompetitorUpdate as CompetitorUpdateSchema,
    CompetitorResponse, CompetitorUpdateResponse, CompetitorDigest,
    AIStatus, AIProviderStatus, AIProviderUsage, AIProviderPreference,
    AIUsageResponse, ExtractedDate, KeyTerm,
    TranscriptActionItem, TranscriptDecision, TranscriptSpeaker,
    TranscriptActionItemsResponse, TranscriptDecisionsResponse,
    TranscriptSpeakerAnalysisResponse, TranscriptCreateTasksRequest,
    TranscriptCreateTasksResponse
)
from .ai.assistant import process_chat_message, get_context_suggestions
from .ai.llm_client import OllamaClient
from .ai.providers import OpenAIClient, AnthropicClient, CloudflareAIClient, LLMProvider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI"])


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_conversation_with_org_check(
    conversation_id: int,
    organization_id: int,
    user_id: int,
    db: Session
) -> AIConversation:
    """Get conversation with organization and user validation."""
    conversation = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.organization_id == organization_id,
        AIConversation.user_id == user_id
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def get_competitor_with_org_check(
    competitor_id: int,
    organization_id: int,
    db: Session
) -> Competitor:
    """Get competitor with organization validation."""
    competitor = db.query(Competitor).filter(
        Competitor.id == competitor_id,
        Competitor.organization_id == organization_id
    ).first()
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return competitor


def increment_ai_usage(db: Session, organization_id: int):
    """Increment AI usage counter for organization."""
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if org:
        org.ai_summaries_used = (org.ai_summaries_used or 0) + 1
        db.commit()


# =============================================================================
# AI STATUS
# =============================================================================

@router.get("/status", response_model=AIStatus)
async def get_ai_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI feature status and availability for all providers."""
    import httpx
    from .models import LLMUsage
    from sqlalchemy import func
    from datetime import datetime, timedelta

    providers = {}

    # Check Ollama availability
    ollama_client = OllamaClient()
    try:
        response = httpx.get(f"{ollama_client.base_url}/api/tags", timeout=5.0)
        ollama_available = response.status_code == 200
    except Exception:
        ollama_available = False

    providers["ollama"] = AIProviderStatus(
        provider=LLMProvider.OLLAMA.value,
        available=ollama_available,
        configured=True,  # Ollama is always "configured" (no API key needed)
        model=ollama_client.model
    )

    # Check Cloudflare Workers AI availability
    cloudflare_client = CloudflareAIClient()
    cloudflare_configured = bool(os.getenv("CLOUDFLARE_ACCOUNT_ID")) and bool(os.getenv("CLOUDFLARE_API_TOKEN"))
    cloudflare_available = cloudflare_configured  # Assume available if configured
    providers["cloudflare"] = AIProviderStatus(
        provider=LLMProvider.CLOUDFLARE.value,
        available=cloudflare_available,
        configured=cloudflare_configured,
        model=cloudflare_client.model
    )

    # Check OpenAI availability
    openai_client = OpenAIClient()
    openai_configured = bool(os.getenv("OPENAI_API_KEY"))
    openai_available = openai_configured  # Assume available if configured
    providers["openai"] = AIProviderStatus(
        provider=LLMProvider.OPENAI.value,
        available=openai_available,
        configured=openai_configured,
        model=openai_client.model
    )

    # Check Anthropic availability
    anthropic_client = AnthropicClient()
    anthropic_configured = bool(os.getenv("ANTHROPIC_API_KEY"))
    anthropic_available = anthropic_configured  # Assume available if configured
    providers["anthropic"] = AIProviderStatus(
        provider=LLMProvider.ANTHROPIC.value,
        available=anthropic_available,
        configured=anthropic_configured,
        model=anthropic_client.model
    )

    # Get organization and preferences
    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()

    preferred_provider = None
    if org and org.settings:
        preferred_provider = org.settings.get("llm_provider")

    # Get usage stats by provider (this month)
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    usage_by_provider = {}

    try:
        usage_stats = db.query(
            LLMUsage.provider,
            func.count(LLMUsage.id).label("requests"),
            func.sum(LLMUsage.tokens_input + LLMUsage.tokens_output).label("tokens"),
            func.sum(LLMUsage.estimated_cost).label("cost")
        ).filter(
            LLMUsage.organization_id == current_user.organization_id,
            LLMUsage.created_at >= month_start
        ).group_by(LLMUsage.provider).all()

        for stat in usage_stats:
            usage_by_provider[stat.provider] = AIProviderUsage(
                requests=stat.requests or 0,
                tokens=int(stat.tokens or 0),
                cost=float(stat.cost or 0)
            )
    except Exception as e:
        logger.warning(f"Failed to get usage stats: {e}")

    fallback_enabled = os.getenv("LLM_ENABLE_FALLBACK", "true").lower() == "true"

    return AIStatus(
        ollama_available=ollama_available,
        model=ollama_client.model,
        providers=providers,
        preferred_provider=preferred_provider,
        fallback_enabled=fallback_enabled,
        ai_usage_this_month=org.ai_summaries_used or 0 if org else 0,
        ai_usage_limit=None,
        usage_by_provider=usage_by_provider,
        features_enabled={
            "assistant": os.getenv("AI_ASSISTANT_ENABLED", "true").lower() == "true",
            "document_summary": os.getenv("AI_DOCUMENT_SUMMARY_ENABLED", "true").lower() == "true",
            "competitor_monitor": os.getenv("AI_COMPETITOR_MONITOR_ENABLED", "true").lower() == "true",
        }
    )


@router.put("/provider")
async def set_ai_provider(
    data: AIProviderPreference,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set the preferred AI provider for the organization."""
    valid_providers = [p.value for p in LLMProvider]
    if data.provider not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {', '.join(valid_providers)}"
        )

    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Update org settings
    if not org.settings:
        org.settings = {}
    org.settings["llm_provider"] = data.provider
    db.commit()

    return {"status": "success", "provider": data.provider}


@router.get("/usage", response_model=AIUsageResponse)
async def get_ai_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed AI usage statistics for the current month."""
    from .models import LLMUsage
    from sqlalchemy import func
    from datetime import datetime

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_end = datetime.utcnow()

    # Get usage by provider
    provider_stats = db.query(
        LLMUsage.provider,
        func.count(LLMUsage.id).label("requests"),
        func.sum(LLMUsage.tokens_input + LLMUsage.tokens_output).label("tokens"),
        func.sum(LLMUsage.estimated_cost).label("cost")
    ).filter(
        LLMUsage.organization_id == current_user.organization_id,
        LLMUsage.created_at >= month_start
    ).group_by(LLMUsage.provider).all()

    by_provider = {}
    total_requests = 0
    total_tokens = 0
    total_cost = 0.0

    for stat in provider_stats:
        requests = stat.requests or 0
        tokens = int(stat.tokens or 0)
        cost = float(stat.cost or 0)

        by_provider[stat.provider] = AIProviderUsage(
            requests=requests,
            tokens=tokens,
            cost=cost
        )
        total_requests += requests
        total_tokens += tokens
        total_cost += cost

    # Get usage by feature
    feature_stats = db.query(
        LLMUsage.feature,
        func.count(LLMUsage.id).label("count")
    ).filter(
        LLMUsage.organization_id == current_user.organization_id,
        LLMUsage.created_at >= month_start
    ).group_by(LLMUsage.feature).all()

    by_feature = {stat.feature or "unknown": stat.count for stat in feature_stats}

    return AIUsageResponse(
        total_requests=total_requests,
        total_tokens=total_tokens,
        total_cost=total_cost,
        by_provider=by_provider,
        by_feature=by_feature,
        period_start=month_start,
        period_end=month_end
    )


# =============================================================================
# AI ASSISTANT
# =============================================================================

@router.post("/chat", response_model=AIChatResponse)
async def chat_with_assistant(
    request: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a message to the AI assistant.

    Creates a new conversation if conversation_id is not provided.
    """
    # Get or create conversation
    if request.conversation_id:
        conversation = get_conversation_with_org_check(
            request.conversation_id,
            current_user.organization_id,
            current_user.id,
            db
        )
    else:
        # Create new conversation
        conversation = AIConversation(
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            title=request.message[:100]  # Use first part of message as title
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # Get conversation history
    history = []
    if request.conversation_id:
        messages = db.query(AIMessage).filter(
            AIMessage.conversation_id == conversation.id
        ).order_by(AIMessage.created_at).limit(10).all()
        history = [{"role": m.role, "content": m.content} for m in messages]

    # Save user message
    user_message = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=request.message
    )
    db.add(user_message)
    db.commit()

    # Process with AI
    result = await process_chat_message(
        db=db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        message=request.message,
        conversation_history=history
    )

    # Save assistant response
    assistant_message = AIMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=result["response"],
        tokens_used=result.get("tokens_used", 0),
        model_used=result.get("model"),
        data_cards=result.get("data_cards"),
        suggested_actions=result.get("suggested_actions")
    )
    db.add(assistant_message)

    # Update conversation title if it's the first message
    if not request.conversation_id and len(request.message) > 0:
        # Use first 50 chars of message as title
        conversation.title = request.message[:50] + ("..." if len(request.message) > 50 else "")

    db.commit()
    db.refresh(assistant_message)

    # Track AI usage
    increment_ai_usage(db, current_user.organization_id)

    # Filter out invalid data cards (must be dicts with required fields)
    raw_cards = result.get("data_cards", [])
    valid_cards = []
    for card in raw_cards:
        if isinstance(card, dict) and "type" in card and "title" in card:
            valid_cards.append(card)

    # Filter out invalid suggested actions
    raw_actions = result.get("suggested_actions", [])
    valid_actions = []
    for action in raw_actions:
        if isinstance(action, dict) and "label" in action and "action" in action:
            valid_actions.append(action)

    return AIChatResponse(
        response=result["response"],
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        data_cards=valid_cards,
        suggested_actions=valid_actions,
        tokens_used=result.get("tokens_used", 0),
        model=result.get("model", "unknown")
    )


@router.get("/conversations", response_model=List[AIConversationListItem])
async def list_conversations(
    limit: int = 20,
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's AI conversations."""
    query = db.query(AIConversation).filter(
        AIConversation.organization_id == current_user.organization_id,
        AIConversation.user_id == current_user.id
    )

    if not include_archived:
        query = query.filter(AIConversation.is_archived == False)

    conversations = query.order_by(desc(AIConversation.updated_at)).limit(limit).all()

    result = []
    for conv in conversations:
        # Get message count and last message
        message_count = db.query(AIMessage).filter(
            AIMessage.conversation_id == conv.id
        ).count()

        last_message = db.query(AIMessage).filter(
            AIMessage.conversation_id == conv.id
        ).order_by(desc(AIMessage.created_at)).first()

        result.append(AIConversationListItem(
            id=conv.id,
            title=conv.title,
            is_archived=conv.is_archived,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=message_count,
            last_message_preview=last_message.content[:100] if last_message else None
        ))

    return result


@router.get("/conversations/{conversation_id}", response_model=AIConversationResponse)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a conversation with all messages."""
    conversation = get_conversation_with_org_check(
        conversation_id,
        current_user.organization_id,
        current_user.id,
        db
    )

    messages = db.query(AIMessage).filter(
        AIMessage.conversation_id == conversation.id
    ).order_by(AIMessage.created_at).all()

    return AIConversationResponse(
        id=conversation.id,
        title=conversation.title,
        is_archived=conversation.is_archived,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[
            AIMessageResponse(
                id=m.id,
                role=m.role,
                content=m.content,
                tokens_used=m.tokens_used,
                model_used=m.model_used,
                data_cards=m.data_cards,
                suggested_actions=m.suggested_actions,
                created_at=m.created_at
            )
            for m in messages
        ]
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a conversation."""
    conversation = get_conversation_with_org_check(
        conversation_id,
        current_user.organization_id,
        current_user.id,
        db
    )

    db.delete(conversation)
    db.commit()

    return {"message": "Conversation deleted"}


@router.post("/conversations/{conversation_id}/archive")
async def archive_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Archive a conversation."""
    conversation = get_conversation_with_org_check(
        conversation_id,
        current_user.organization_id,
        current_user.id,
        db
    )

    conversation.is_archived = True
    db.commit()

    return {"message": "Conversation archived"}


@router.get("/suggestions", response_model=AISuggestionsResponse)
async def get_suggestions(
    current_page: str = "",
    current_user: User = Depends(get_current_user)
):
    """Get context-aware suggestions for the AI assistant."""
    suggestions = get_context_suggestions(current_page)
    return AISuggestionsResponse(
        suggestions=suggestions,
        context=current_page
    )


# =============================================================================
# DOCUMENT AI
# =============================================================================

@router.post("/documents/{document_id}/summarize", response_model=DocumentSummaryResponse)
async def summarize_document_endpoint(
    document_id: int,
    force_regenerate: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate an AI summary of a document.

    Extracts key terms, dates, and action items.
    """
    from .ai.document_ai import extract_text_from_file, summarize_document, detect_document_type

    # Get document with org check
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == current_user.organization_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if summary already exists
    existing = db.query(DocumentSummary).filter(
        DocumentSummary.document_id == document_id
    ).first()

    if existing and not force_regenerate:
        return DocumentSummaryResponse(
            id=existing.id,
            document_id=existing.document_id,
            summary=existing.summary,
            document_type=existing.document_type,
            key_terms=[KeyTerm(**t) for t in (existing.key_terms or [])],
            extracted_dates=[ExtractedDate(**d) for d in (existing.extracted_dates or [])],
            action_items=existing.action_items or [],
            risk_flags=existing.risk_flags or [],
            model_used=existing.model_used,
            tokens_used=existing.tokens_used,
            created_at=existing.created_at
        )

    # Check if document has a file
    if not document.file_path:
        raise HTTPException(
            status_code=400,
            detail="Document has no file attached. Upload a file first."
        )

    # Extract text from document
    try:
        file_path = os.path.join("uploads", document.file_path)
        text, file_type = extract_text_from_file(file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document file not found on server")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not text or len(text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Could not extract enough text from document. The file may be empty or scanned."
        )

    # Generate summary with AI
    result = await summarize_document(text)

    if not result:
        raise HTTPException(
            status_code=503,
            detail="AI summarization failed. Ollama may not be available."
        )

    # Detect document type if not returned by AI
    doc_type = result.get("document_type") or detect_document_type(text)

    # Save or update summary
    if existing:
        existing.summary = result.get("summary")
        existing.document_type = doc_type
        existing.key_terms = result.get("key_terms", [])
        existing.extracted_dates = result.get("extracted_dates", [])
        existing.action_items = result.get("action_items", [])
        existing.risk_flags = result.get("risk_flags", [])
        existing.model_used = result.get("model_used")
        existing.tokens_used = result.get("tokens_used")
        existing.processing_time_ms = result.get("processing_time_ms")
        db.commit()
        db.refresh(existing)
        summary_obj = existing
    else:
        summary_obj = DocumentSummary(
            document_id=document_id,
            summary=result.get("summary"),
            document_type=doc_type,
            key_terms=result.get("key_terms", []),
            extracted_dates=result.get("extracted_dates", []),
            action_items=result.get("action_items", []),
            risk_flags=result.get("risk_flags", []),
            model_used=result.get("model_used"),
            tokens_used=result.get("tokens_used"),
            processing_time_ms=result.get("processing_time_ms")
        )
        db.add(summary_obj)
        db.commit()
        db.refresh(summary_obj)

    # Track AI usage
    increment_ai_usage(db, current_user.organization_id)

    return DocumentSummaryResponse(
        id=summary_obj.id,
        document_id=summary_obj.document_id,
        summary=summary_obj.summary,
        document_type=summary_obj.document_type,
        key_terms=[KeyTerm(**t) for t in (summary_obj.key_terms or [])],
        extracted_dates=[ExtractedDate(**d) for d in (summary_obj.extracted_dates or [])],
        action_items=summary_obj.action_items or [],
        risk_flags=summary_obj.risk_flags or [],
        model_used=summary_obj.model_used,
        tokens_used=summary_obj.tokens_used,
        created_at=summary_obj.created_at
    )


@router.post("/documents/{document_id}/extract-deadlines", response_model=DeadlineExtractionResponse)
async def extract_deadlines_endpoint(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Extract deadlines and dates from a document.
    """
    from .ai.document_ai import extract_text_from_file
    from .ai.deadline_extractor import extract_deadlines_smart

    # Get document with org check
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == current_user.organization_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if document has a file
    if not document.file_path:
        raise HTTPException(
            status_code=400,
            detail="Document has no file attached. Upload a file first."
        )

    # Extract text from document
    try:
        file_path = os.path.join("uploads", document.file_path)
        text, _ = extract_text_from_file(file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document file not found on server")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not text or len(text.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Could not extract enough text from document."
        )

    # Extract deadlines using smart extraction
    result = extract_deadlines_smart(text)

    # Convert to response format
    deadlines = []
    for d in result.get("deadlines", []):
        deadlines.append(ExtractedDate(
            description=d.get("title", ""),
            date=d.get("date", ""),
            type=d.get("type"),
            requires_action=d.get("requires_action", False),
            confidence=d.get("confidence", "medium"),
            source_text=d.get("source_text")
        ))

    return DeadlineExtractionResponse(
        document_id=document_id,
        deadlines=deadlines,
        recurring_dates=result.get("recurring_dates", [])
    )


@router.get("/documents/{document_id}/summary", response_model=DocumentSummaryResponse)
async def get_document_summary(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get existing document summary."""
    # Get document with org check
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == current_user.organization_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    summary = db.query(DocumentSummary).filter(
        DocumentSummary.document_id == document_id
    ).first()

    if not summary:
        raise HTTPException(status_code=404, detail="No summary found for this document")

    return DocumentSummaryResponse(
        id=summary.id,
        document_id=summary.document_id,
        summary=summary.summary,
        document_type=summary.document_type,
        key_terms=[KeyTerm(**t) for t in (summary.key_terms or [])],
        extracted_dates=[ExtractedDate(**d) for d in (summary.extracted_dates or [])],
        action_items=summary.action_items or [],
        risk_flags=summary.risk_flags or [],
        model_used=summary.model_used,
        tokens_used=summary.tokens_used,
        created_at=summary.created_at
    )


# =============================================================================
# COMPETITOR MONITORING
# =============================================================================

@router.get("/competitors", response_model=List[CompetitorResponse])
async def list_competitors(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List tracked competitors."""
    query = db.query(Competitor).filter(
        Competitor.organization_id == current_user.organization_id
    )

    if not include_inactive:
        query = query.filter(Competitor.is_active == True)

    competitors = query.order_by(Competitor.name).all()

    result = []
    for comp in competitors:
        update_count = db.query(CompetitorUpdate).filter(
            CompetitorUpdate.competitor_id == comp.id
        ).count()

        result.append(CompetitorResponse(
            id=comp.id,
            name=comp.name,
            website=comp.website,
            description=comp.description,
            keywords=comp.keywords,
            rss_urls=comp.rss_urls,
            industry=comp.industry,
            is_active=comp.is_active,
            last_checked_at=comp.last_checked_at,
            created_at=comp.created_at,
            updated_at=comp.updated_at,
            update_count=update_count
        ))

    return result


@router.post("/competitors", response_model=CompetitorResponse)
async def create_competitor(
    competitor: CompetitorCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new competitor to track."""
    new_competitor = Competitor(
        organization_id=current_user.organization_id,
        name=competitor.name,
        website=competitor.website,
        description=competitor.description,
        keywords=competitor.keywords,
        rss_urls=competitor.rss_urls,
        industry=competitor.industry
    )

    db.add(new_competitor)
    db.commit()
    db.refresh(new_competitor)

    return CompetitorResponse(
        id=new_competitor.id,
        name=new_competitor.name,
        website=new_competitor.website,
        description=new_competitor.description,
        keywords=new_competitor.keywords,
        rss_urls=new_competitor.rss_urls,
        industry=new_competitor.industry,
        is_active=new_competitor.is_active,
        last_checked_at=new_competitor.last_checked_at,
        created_at=new_competitor.created_at,
        updated_at=new_competitor.updated_at,
        update_count=0
    )


@router.get("/competitors/{competitor_id}", response_model=CompetitorResponse)
async def get_competitor(
    competitor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get competitor details."""
    competitor = get_competitor_with_org_check(
        competitor_id,
        current_user.organization_id,
        db
    )

    update_count = db.query(CompetitorUpdate).filter(
        CompetitorUpdate.competitor_id == competitor.id
    ).count()

    return CompetitorResponse(
        id=competitor.id,
        name=competitor.name,
        website=competitor.website,
        description=competitor.description,
        keywords=competitor.keywords,
        rss_urls=competitor.rss_urls,
        industry=competitor.industry,
        is_active=competitor.is_active,
        last_checked_at=competitor.last_checked_at,
        created_at=competitor.created_at,
        updated_at=competitor.updated_at,
        update_count=update_count
    )


@router.patch("/competitors/{competitor_id}", response_model=CompetitorResponse)
async def update_competitor(
    competitor_id: int,
    update: CompetitorUpdateSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a competitor."""
    competitor = get_competitor_with_org_check(
        competitor_id,
        current_user.organization_id,
        db
    )

    update_data = update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(competitor, field, value)

    db.commit()
    db.refresh(competitor)

    update_count = db.query(CompetitorUpdate).filter(
        CompetitorUpdate.competitor_id == competitor.id
    ).count()

    return CompetitorResponse(
        id=competitor.id,
        name=competitor.name,
        website=competitor.website,
        description=competitor.description,
        keywords=competitor.keywords,
        rss_urls=competitor.rss_urls,
        industry=competitor.industry,
        is_active=competitor.is_active,
        last_checked_at=competitor.last_checked_at,
        created_at=competitor.created_at,
        updated_at=competitor.updated_at,
        update_count=update_count
    )


@router.delete("/competitors/{competitor_id}")
async def delete_competitor(
    competitor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a competitor."""
    competitor = get_competitor_with_org_check(
        competitor_id,
        current_user.organization_id,
        db
    )

    db.delete(competitor)
    db.commit()

    return {"message": "Competitor deleted"}


@router.get("/competitors/{competitor_id}/updates", response_model=List[CompetitorUpdateResponse])
async def get_competitor_updates(
    competitor_id: int,
    limit: int = 20,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get news and updates for a competitor."""
    competitor = get_competitor_with_org_check(
        competitor_id,
        current_user.organization_id,
        db
    )

    query = db.query(CompetitorUpdate).filter(
        CompetitorUpdate.competitor_id == competitor.id
    )

    if unread_only:
        query = query.filter(CompetitorUpdate.is_read == False)

    updates = query.order_by(desc(CompetitorUpdate.published_at)).limit(limit).all()

    return [
        CompetitorUpdateResponse(
            id=u.id,
            competitor_id=u.competitor_id,
            update_type=u.update_type,
            title=u.title,
            summary=u.summary,
            source_url=u.source_url,
            source_name=u.source_name,
            relevance_score=u.relevance_score,
            sentiment=u.sentiment,
            is_read=u.is_read,
            is_starred=u.is_starred,
            published_at=u.published_at,
            created_at=u.created_at
        )
        for u in updates
    ]


@router.post("/competitors/{competitor_id}/updates/{update_id}/read")
async def mark_update_read(
    competitor_id: int,
    update_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a competitor update as read."""
    competitor = get_competitor_with_org_check(
        competitor_id,
        current_user.organization_id,
        db
    )

    update = db.query(CompetitorUpdate).filter(
        CompetitorUpdate.id == update_id,
        CompetitorUpdate.competitor_id == competitor.id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    update.is_read = True
    db.commit()

    return {"message": "Update marked as read"}


@router.post("/competitors/{competitor_id}/updates/{update_id}/star")
async def toggle_update_star(
    competitor_id: int,
    update_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle star on a competitor update."""
    competitor = get_competitor_with_org_check(
        competitor_id,
        current_user.organization_id,
        db
    )

    update = db.query(CompetitorUpdate).filter(
        CompetitorUpdate.id == update_id,
        CompetitorUpdate.competitor_id == competitor.id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    update.is_starred = not update.is_starred
    db.commit()

    return {"is_starred": update.is_starred}


@router.post("/competitors/refresh")
async def refresh_all_competitors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Force refresh news for all active competitors.

    Fetches news from NewsAPI and RSS feeds, saves new updates to database.
    """
    from .ai.competitor_monitor import (
        CompetitorMonitor,
        calculate_relevance_score,
        detect_sentiment,
        classify_update_type
    )

    competitors = db.query(Competitor).filter(
        Competitor.organization_id == current_user.organization_id,
        Competitor.is_active == True
    ).all()

    if not competitors:
        return {"message": "No active competitors to refresh", "updates_found": 0}

    monitor = CompetitorMonitor()
    total_updates = 0

    for competitor in competitors:
        try:
            # Fetch updates from NewsAPI and RSS
            updates = await monitor.fetch_competitor_updates(
                competitor_name=competitor.name,
                keywords=competitor.keywords,
                rss_urls=competitor.rss_urls,
                days_back=7
            )

            # Process news articles
            for article in updates.get("news", []):
                title = article.get("title", "")
                if not title:
                    continue

                # Check if we already have this update (by title)
                existing = db.query(CompetitorUpdate).filter(
                    CompetitorUpdate.competitor_id == competitor.id,
                    CompetitorUpdate.title == title
                ).first()

                if existing:
                    continue

                # Create new update
                content = article.get("description", "") or article.get("content", "")
                new_update = CompetitorUpdate(
                    competitor_id=competitor.id,
                    update_type=classify_update_type(title, content),
                    title=title,
                    summary=content[:500] if content else None,
                    source_url=article.get("url"),
                    source_name=article.get("source", {}).get("name") if isinstance(article.get("source"), dict) else None,
                    relevance_score=calculate_relevance_score(title, content, competitor.keywords or []),
                    sentiment=detect_sentiment(title + " " + content),
                    published_at=datetime.fromisoformat(article["publishedAt"].replace("Z", "+00:00")) if article.get("publishedAt") else None
                )
                db.add(new_update)
                total_updates += 1

            # Process RSS entries
            for entry in updates.get("rss_entries", []):
                title = entry.get("title", "")
                if not title:
                    continue

                existing = db.query(CompetitorUpdate).filter(
                    CompetitorUpdate.competitor_id == competitor.id,
                    CompetitorUpdate.title == title
                ).first()

                if existing:
                    continue

                content = entry.get("summary", "")
                new_update = CompetitorUpdate(
                    competitor_id=competitor.id,
                    update_type=classify_update_type(title, content),
                    title=title,
                    summary=content[:500] if content else None,
                    source_url=entry.get("link"),
                    source_name=entry.get("source"),
                    relevance_score=calculate_relevance_score(title, content, competitor.keywords or []),
                    sentiment=detect_sentiment(title + " " + content),
                )
                db.add(new_update)
                total_updates += 1

            # Update last_checked_at
            competitor.last_checked_at = datetime.utcnow()

        except Exception as e:
            logger.error(f"Error refreshing competitor {competitor.name}: {e}")
            continue

    db.commit()

    api_key_configured = bool(os.getenv("NEWS_API_KEY"))

    return {
        "message": f"Refresh completed for {len(competitors)} competitors",
        "updates_found": total_updates,
        "note": None if api_key_configured else "Configure NEWS_API_KEY for more news sources"
    }


# =============================================================================
# TRANSCRIPT ANALYSIS (Enhanced Meeting Transcripts)
# =============================================================================

def get_transcript_with_org_check(
    transcript_id: int,
    organization_id: int,
    db: Session
) -> MeetingTranscript:
    """Get transcript with organization validation."""
    transcript = db.query(MeetingTranscript).filter(
        MeetingTranscript.id == transcript_id,
        MeetingTranscript.organization_id == organization_id
    ).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return transcript


@router.post("/transcripts/{transcript_id}/extract-actions", response_model=TranscriptActionItemsResponse)
async def extract_transcript_action_items(
    transcript_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Extract structured action items from a meeting transcript.

    Returns action items with assignee, due date, and priority.
    """
    from .ai.llm_client import OllamaClient, parse_json_response
    from .ai.prompts import TRANSCRIPT_PROMPTS

    transcript = get_transcript_with_org_check(
        transcript_id,
        current_user.organization_id,
        db
    )

    if not transcript.transcript_text:
        raise HTTPException(status_code=400, detail="Transcript has no text content")

    # Use enhanced prompt for structured action items
    client = OllamaClient()
    prompt = TRANSCRIPT_PROMPTS["extract_action_items"].format(
        transcript=transcript.transcript_text[:30000]  # Limit for context
    )

    response = await client.generate(
        prompt=prompt,
        temperature=0.2,
        max_tokens=2048
    )

    if not response.success:
        raise HTTPException(
            status_code=503,
            detail=f"AI extraction failed: {response.error}"
        )

    parsed = parse_json_response(response.content)

    action_items = []
    if parsed and "action_items" in parsed:
        for item in parsed["action_items"]:
            action_items.append(TranscriptActionItem(
                task=item.get("task", ""),
                assignee=item.get("assignee"),
                due_date=item.get("due_date"),
                due_description=item.get("due_description"),
                priority=item.get("priority", "medium"),
                context=item.get("context")
            ))

    # Track AI usage
    increment_ai_usage(db, current_user.organization_id)

    return TranscriptActionItemsResponse(
        transcript_id=transcript_id,
        action_items=action_items,
        total_count=len(action_items)
    )


@router.post("/transcripts/{transcript_id}/extract-decisions", response_model=TranscriptDecisionsResponse)
async def extract_transcript_decisions(
    transcript_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Extract key decisions from a meeting transcript.

    Returns decisions with rationale and follow-ups.
    """
    from .ai.llm_client import OllamaClient, parse_json_response
    from .ai.prompts import TRANSCRIPT_PROMPTS

    transcript = get_transcript_with_org_check(
        transcript_id,
        current_user.organization_id,
        db
    )

    if not transcript.transcript_text:
        raise HTTPException(status_code=400, detail="Transcript has no text content")

    client = OllamaClient()
    prompt = TRANSCRIPT_PROMPTS["extract_decisions"].format(
        transcript=transcript.transcript_text[:30000]
    )

    response = await client.generate(
        prompt=prompt,
        temperature=0.2,
        max_tokens=2048
    )

    if not response.success:
        raise HTTPException(
            status_code=503,
            detail=f"AI extraction failed: {response.error}"
        )

    parsed = parse_json_response(response.content)

    decisions = []
    if parsed and "decisions" in parsed:
        for dec in parsed["decisions"]:
            decisions.append(TranscriptDecision(
                decision=dec.get("decision", ""),
                made_by=dec.get("made_by"),
                rationale=dec.get("rationale"),
                conditions=dec.get("conditions", []),
                follow_ups=dec.get("follow_ups", [])
            ))

    increment_ai_usage(db, current_user.organization_id)

    return TranscriptDecisionsResponse(
        transcript_id=transcript_id,
        decisions=decisions
    )


@router.post("/transcripts/{transcript_id}/analyze-speakers", response_model=TranscriptSpeakerAnalysisResponse)
async def analyze_transcript_speakers(
    transcript_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze speaker participation in a meeting transcript.

    Returns word counts, topics, and meeting dynamics.
    """
    from .ai.llm_client import OllamaClient, parse_json_response
    from .ai.prompts import TRANSCRIPT_PROMPTS

    transcript = get_transcript_with_org_check(
        transcript_id,
        current_user.organization_id,
        db
    )

    if not transcript.transcript_text:
        raise HTTPException(status_code=400, detail="Transcript has no text content")

    client = OllamaClient()
    prompt = TRANSCRIPT_PROMPTS["speaker_analysis"].format(
        transcript=transcript.transcript_text[:30000]
    )

    response = await client.generate(
        prompt=prompt,
        temperature=0.3,
        max_tokens=2048
    )

    if not response.success:
        raise HTTPException(
            status_code=503,
            detail=f"AI analysis failed: {response.error}"
        )

    parsed = parse_json_response(response.content)

    speakers = []
    meeting_dynamics = None
    suggestions = []

    if parsed:
        for spk in parsed.get("speakers", []):
            speakers.append(TranscriptSpeaker(
                name=spk.get("name", "Unknown"),
                word_count=spk.get("word_count", 0),
                percentage=spk.get("percentage", 0.0),
                main_topics=spk.get("main_topics", []),
                sentiment=spk.get("sentiment", "neutral")
            ))
        meeting_dynamics = parsed.get("meeting_dynamics")
        suggestions = parsed.get("suggestions", [])

    increment_ai_usage(db, current_user.organization_id)

    return TranscriptSpeakerAnalysisResponse(
        transcript_id=transcript_id,
        speakers=speakers,
        meeting_dynamics=meeting_dynamics,
        suggestions=suggestions
    )


@router.post("/transcripts/{transcript_id}/create-tasks", response_model=TranscriptCreateTasksResponse)
async def create_tasks_from_transcript(
    transcript_id: int,
    request: TranscriptCreateTasksRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create tasks from extracted action items.

    First extracts action items if not already done, then creates tasks.
    """
    from .ai.llm_client import OllamaClient, parse_json_response
    from .ai.prompts import TRANSCRIPT_PROMPTS
    from datetime import timedelta
    import json

    transcript = get_transcript_with_org_check(
        transcript_id,
        current_user.organization_id,
        db
    )

    if not transcript.transcript_text:
        raise HTTPException(status_code=400, detail="Transcript has no text content")

    # Verify board belongs to user's org
    board = db.query(TaskBoard).filter(
        TaskBoard.id == request.board_id,
        TaskBoard.organization_id == current_user.organization_id
    ).first()

    if not board:
        raise HTTPException(status_code=404, detail="Task board not found")

    # Get the first column (usually "To Do")
    first_column = db.query(TaskColumn).filter(
        TaskColumn.board_id == board.id
    ).order_by(TaskColumn.position).first()

    # Extract action items
    client = OllamaClient()
    prompt = TRANSCRIPT_PROMPTS["extract_action_items"].format(
        transcript=transcript.transcript_text[:30000]
    )

    response = await client.generate(
        prompt=prompt,
        temperature=0.2,
        max_tokens=2048
    )

    if not response.success:
        raise HTTPException(
            status_code=503,
            detail=f"AI extraction failed: {response.error}"
        )

    parsed = parse_json_response(response.content)

    action_items = []
    if parsed and "action_items" in parsed:
        action_items = parsed["action_items"]

    if not action_items:
        return TranscriptCreateTasksResponse(
            transcript_id=transcript_id,
            tasks_created=0,
            task_ids=[]
        )

    # Filter if specific indices provided
    if request.action_item_indices is not None:
        action_items = [
            action_items[i] for i in request.action_item_indices
            if 0 <= i < len(action_items)
        ]

    # Create tasks
    task_ids = []
    for item in action_items:
        # Parse due date if provided
        due_date = None
        if item.get("due_date"):
            try:
                from datetime import datetime
                due_date = datetime.strptime(item["due_date"], "%Y-%m-%d")
            except ValueError:
                pass

        # Map priority
        priority_map = {"high": "high", "medium": "medium", "low": "low"}
        priority = priority_map.get(item.get("priority", "medium"), "medium")

        task = Task(
            title=item.get("task", "Action item from meeting")[:255],
            description=f"From meeting: {transcript.title}\n\nContext: {item.get('context', '')}",
            board_id=request.board_id,
            column_id=first_column.id if first_column else None,
            status="todo",
            priority=priority,
            due_date=due_date,
            created_by_id=current_user.id
        )
        db.add(task)
        db.flush()  # Get the ID
        task_ids.append(task.id)

    # Update transcript to store that tasks were created
    existing_action_items = json.loads(transcript.action_items) if transcript.action_items else []
    for item in action_items:
        if item.get("task") not in existing_action_items:
            existing_action_items.append(item.get("task"))
    transcript.action_items = json.dumps(existing_action_items)

    db.commit()

    increment_ai_usage(db, current_user.organization_id)

    return TranscriptCreateTasksResponse(
        transcript_id=transcript_id,
        tasks_created=len(task_ids),
        task_ids=task_ids
    )
