"""
Marketing API routes for email templates, campaigns, and social media management.
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import os
from cryptography.fernet import Fernet
import base64
import hashlib

from .database import get_db
from .models import (
    User, Organization, EmailTemplate, MarketingCampaign, CampaignVersion,
    EmailAnalytics, SocialAnalytics, EmailIntegration, OAuthConnection,
    EmailTemplateType, SocialPlatform, CampaignStatus
)
from .auth import get_current_user
from pydantic import BaseModel


def _get_api_key_encryption_key() -> bytes:
    """Get the encryption key for API keys."""
    key_source = os.getenv("APP_ENCRYPTION_KEY", "default-dev-key-change-in-production")
    # Derive a Fernet-compatible key (32 bytes, base64 encoded = 44 chars)
    key_bytes = hashlib.sha256(key_source.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key for storage."""
    if not api_key:
        return ""
    fernet = Fernet(_get_api_key_encryption_key())
    return fernet.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key from storage."""
    if not encrypted_key:
        return ""
    try:
        fernet = Fernet(_get_api_key_encryption_key())
        return fernet.decrypt(encrypted_key.encode()).decode()
    except Exception:
        return ""

router = APIRouter()


# ============ Pydantic Schemas ============

class EmailTemplateCreate(BaseModel):
    name: str
    template_type: str  # newsletter, announcement, promotion, transactional, welcome, other
    subject: str
    html_content: str
    text_content: Optional[str] = None
    variables: Optional[str] = None  # JSON string of available variables

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    template_type: Optional[str] = None
    subject: Optional[str] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    variables: Optional[str] = None
    is_active: Optional[bool] = None

class EmailTemplateResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    template_type: str
    subject: str
    html_content: str
    text_content: Optional[str]
    variables: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CampaignCreate(BaseModel):
    name: str
    campaign_type: str  # email, social, both
    description: Optional[str] = None

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class CampaignResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    campaign_type: str
    status: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]

    class Config:
        from_attributes = True


class CampaignVersionCreate(BaseModel):
    platform: str  # email, twitter, linkedin, facebook, instagram
    content: str
    media_urls: Optional[str] = None

class CampaignVersionUpdate(BaseModel):
    content: Optional[str] = None
    media_urls: Optional[str] = None

class CampaignVersionResponse(BaseModel):
    id: int
    campaign_id: int
    platform: str
    content: str
    media_urls: Optional[str]
    is_published: bool
    published_at: Optional[datetime]
    external_post_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SocialPostCreate(BaseModel):
    """Create social posts for multiple platforms at once"""
    campaign_name: str
    original_content: str
    platforms: List[str]  # twitter, linkedin, facebook, instagram
    adapt_content: bool = True  # Whether to adapt content for each platform


class EmailIntegrationCreate(BaseModel):
    provider: str  # mailchimp, sendgrid, resend
    api_key: str
    list_id: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None

class EmailIntegrationUpdate(BaseModel):
    api_key: Optional[str] = None
    list_id: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    is_active: Optional[bool] = None

class EmailIntegrationResponse(BaseModel):
    id: int
    organization_id: int
    provider: str
    is_active: bool
    from_email: Optional[str]
    from_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AnalyticsSummary(BaseModel):
    total_emails_sent: int
    total_opens: int
    total_clicks: int
    open_rate: float
    click_rate: float
    social_impressions: int
    social_engagements: int
    social_clicks: int


def get_user_organization(user: User, db: Session) -> Organization:
    """Get the user's organization or raise 403."""
    if not user.organization_id:
        raise HTTPException(status_code=403, detail="User does not belong to an organization")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


# ============ Email Templates ============

@router.get("/templates", response_model=List[EmailTemplateResponse])
def get_email_templates(
    template_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all email templates for the organization."""
    org = get_user_organization(current_user, db)
    query = db.query(EmailTemplate).filter(EmailTemplate.organization_id == org.id)

    if template_type:
        query = query.filter(EmailTemplate.template_type == template_type)

    return query.order_by(EmailTemplate.updated_at.desc()).all()


@router.post("/templates", response_model=EmailTemplateResponse)
def create_email_template(
    template: EmailTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new email template."""
    org = get_user_organization(current_user, db)

    db_template = EmailTemplate(
        organization_id=org.id,
        name=template.name,
        template_type=template.template_type,
        subject=template.subject,
        html_content=template.html_content,
        text_content=template.text_content,
        variables=template.variables
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


@router.get("/templates/{template_id}", response_model=EmailTemplateResponse)
def get_email_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single email template."""
    org = get_user_organization(current_user, db)
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.organization_id == org.id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.put("/templates/{template_id}", response_model=EmailTemplateResponse)
def update_email_template(
    template_id: int,
    template: EmailTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an email template."""
    org = get_user_organization(current_user, db)
    db_template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.organization_id == org.id
    ).first()

    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")

    for key, value in template.model_dump(exclude_unset=True).items():
        setattr(db_template, key, value)

    db.commit()
    db.refresh(db_template)
    return db_template


@router.delete("/templates/{template_id}")
def delete_email_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an email template."""
    org = get_user_organization(current_user, db)
    db_template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.organization_id == org.id
    ).first()

    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(db_template)
    db.commit()
    return {"message": "Template deleted"}


@router.post("/templates/{template_id}/duplicate", response_model=EmailTemplateResponse)
def duplicate_email_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Duplicate an email template."""
    org = get_user_organization(current_user, db)
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.organization_id == org.id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    new_template = EmailTemplate(
        organization_id=org.id,
        name=f"{template.name} (Copy)",
        template_type=template.template_type,
        subject=template.subject,
        html_content=template.html_content,
        text_content=template.text_content,
        variables=template.variables
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    return new_template


# ============ Marketing Campaigns ============

@router.get("/campaigns", response_model=List[CampaignResponse])
def get_campaigns(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all marketing campaigns."""
    org = get_user_organization(current_user, db)
    query = db.query(MarketingCampaign).filter(MarketingCampaign.organization_id == org.id)

    if status:
        query = query.filter(MarketingCampaign.status == status)

    return query.order_by(MarketingCampaign.created_at.desc()).all()


@router.post("/campaigns", response_model=CampaignResponse)
def create_campaign(
    campaign: CampaignCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new marketing campaign."""
    org = get_user_organization(current_user, db)

    db_campaign = MarketingCampaign(
        organization_id=org.id,
        name=campaign.name,
        campaign_type=campaign.campaign_type,
        description=campaign.description,
        status='draft'
    )
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
def get_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single campaign."""
    org = get_user_organization(current_user, db)
    campaign = db.query(MarketingCampaign).filter(
        MarketingCampaign.id == campaign_id,
        MarketingCampaign.organization_id == org.id
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return campaign


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
def update_campaign(
    campaign_id: int,
    campaign: CampaignUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a campaign."""
    org = get_user_organization(current_user, db)
    db_campaign = db.query(MarketingCampaign).filter(
        MarketingCampaign.id == campaign_id,
        MarketingCampaign.organization_id == org.id
    ).first()

    if not db_campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    for key, value in campaign.model_dump(exclude_unset=True).items():
        setattr(db_campaign, key, value)

    db.commit()
    db.refresh(db_campaign)
    return db_campaign


@router.delete("/campaigns/{campaign_id}")
def delete_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a campaign and all its versions."""
    org = get_user_organization(current_user, db)
    db_campaign = db.query(MarketingCampaign).filter(
        MarketingCampaign.id == campaign_id,
        MarketingCampaign.organization_id == org.id
    ).first()

    if not db_campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Delete versions first
    db.query(CampaignVersion).filter(CampaignVersion.campaign_id == campaign_id).delete()

    db.delete(db_campaign)
    db.commit()
    return {"message": "Campaign deleted"}


# ============ Campaign Versions (Platform-specific content) ============

@router.get("/campaigns/{campaign_id}/versions", response_model=List[CampaignVersionResponse])
def get_campaign_versions(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all versions of a campaign."""
    org = get_user_organization(current_user, db)

    # Verify campaign belongs to org
    campaign = db.query(MarketingCampaign).filter(
        MarketingCampaign.id == campaign_id,
        MarketingCampaign.organization_id == org.id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return db.query(CampaignVersion).filter(CampaignVersion.campaign_id == campaign_id).all()


@router.post("/campaigns/{campaign_id}/versions", response_model=CampaignVersionResponse)
def create_campaign_version(
    campaign_id: int,
    version: CampaignVersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a platform-specific version of a campaign."""
    org = get_user_organization(current_user, db)

    # Verify campaign belongs to org
    campaign = db.query(MarketingCampaign).filter(
        MarketingCampaign.id == campaign_id,
        MarketingCampaign.organization_id == org.id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db_version = CampaignVersion(
        campaign_id=campaign_id,
        platform=version.platform,
        content=version.content,
        media_urls=version.media_urls
    )
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version


@router.put("/campaigns/{campaign_id}/versions/{version_id}", response_model=CampaignVersionResponse)
def update_campaign_version(
    campaign_id: int,
    version_id: int,
    version: CampaignVersionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a campaign version."""
    org = get_user_organization(current_user, db)

    # Verify campaign belongs to org
    campaign = db.query(MarketingCampaign).filter(
        MarketingCampaign.id == campaign_id,
        MarketingCampaign.organization_id == org.id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db_version = db.query(CampaignVersion).filter(
        CampaignVersion.id == version_id,
        CampaignVersion.campaign_id == campaign_id
    ).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")

    for key, value in version.model_dump(exclude_unset=True).items():
        setattr(db_version, key, value)

    db.commit()
    db.refresh(db_version)
    return db_version


@router.delete("/campaigns/{campaign_id}/versions/{version_id}")
def delete_campaign_version(
    campaign_id: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a campaign version."""
    org = get_user_organization(current_user, db)

    # Verify campaign belongs to org
    campaign = db.query(MarketingCampaign).filter(
        MarketingCampaign.id == campaign_id,
        MarketingCampaign.organization_id == org.id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db_version = db.query(CampaignVersion).filter(
        CampaignVersion.id == version_id,
        CampaignVersion.campaign_id == campaign_id
    ).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")

    db.delete(db_version)
    db.commit()
    return {"message": "Version deleted"}


# ============ Social Media Content Adaptation ============

@router.post("/adapt-content")
def adapt_content_for_platforms(
    content: str = Body(..., embed=True),
    platforms: List[str] = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Adapt content for different social media platforms.
    Returns optimized versions for each platform.
    """
    org = get_user_organization(current_user, db)

    # Platform-specific adaptations (basic rules)
    adaptations = {}

    for platform in platforms:
        if platform == 'twitter':
            # Twitter: 280 chars, hashtags, casual tone
            adapted = content[:277] + '...' if len(content) > 280 else content
            adaptations['twitter'] = {
                'content': adapted,
                'char_limit': 280,
                'char_count': len(adapted),
                'tips': ['Add relevant hashtags', 'Use a conversational tone', 'Include a call to action']
            }
        elif platform == 'linkedin':
            # LinkedIn: 3000 chars, professional tone, longer form
            adaptations['linkedin'] = {
                'content': content,
                'char_limit': 3000,
                'char_count': len(content),
                'tips': ['Add professional context', 'Include industry insights', 'End with a question to boost engagement']
            }
        elif platform == 'facebook':
            # Facebook: 63,206 chars, engaging, can be longer
            adaptations['facebook'] = {
                'content': content,
                'char_limit': 63206,
                'char_count': len(content),
                'tips': ['Add emojis for engagement', 'Ask questions', 'Include a clear call to action']
            }
        elif platform == 'instagram':
            # Instagram: 2200 chars, visual focus, hashtags
            adapted = content[:2197] + '...' if len(content) > 2200 else content
            adaptations['instagram'] = {
                'content': adapted,
                'char_limit': 2200,
                'char_count': len(adapted),
                'tips': ['Focus on visual storytelling', 'Add up to 30 hashtags', 'Use line breaks for readability']
            }

    return adaptations


# ============ Email Integrations ============

@router.get("/integrations", response_model=List[EmailIntegrationResponse])
def get_email_integrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all email integrations for the organization."""
    org = get_user_organization(current_user, db)
    return db.query(EmailIntegration).filter(EmailIntegration.organization_id == org.id).all()


@router.post("/integrations", response_model=EmailIntegrationResponse)
def create_email_integration(
    integration: EmailIntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new email integration."""
    org = get_user_organization(current_user, db)

    # Check if integration for this provider already exists
    existing = db.query(EmailIntegration).filter(
        EmailIntegration.organization_id == org.id,
        EmailIntegration.provider == integration.provider
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Integration for {integration.provider} already exists")

    # Encrypt the API key before storage
    encrypted_api_key = encrypt_api_key(integration.api_key)

    db_integration = EmailIntegration(
        organization_id=org.id,
        provider=integration.provider,
        api_key_encrypted=encrypted_api_key,
        default_list_id=integration.list_id,
    )
    db.add(db_integration)
    db.commit()
    db.refresh(db_integration)
    return db_integration


@router.put("/integrations/{integration_id}", response_model=EmailIntegrationResponse)
def update_email_integration(
    integration_id: int,
    integration: EmailIntegrationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an email integration."""
    org = get_user_organization(current_user, db)
    db_integration = db.query(EmailIntegration).filter(
        EmailIntegration.id == integration_id,
        EmailIntegration.organization_id == org.id
    ).first()

    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    update_data = integration.model_dump(exclude_unset=True)

    # Handle API key encryption
    if "api_key" in update_data:
        db_integration.api_key_encrypted = encrypt_api_key(update_data.pop("api_key"))

    # Map schema fields to model fields
    field_mapping = {
        "list_id": "default_list_id",
    }

    for key, value in update_data.items():
        model_key = field_mapping.get(key, key)
        if hasattr(db_integration, model_key):
            setattr(db_integration, model_key, value)

    db.commit()
    db.refresh(db_integration)
    return db_integration


@router.delete("/integrations/{integration_id}")
def delete_email_integration(
    integration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an email integration."""
    org = get_user_organization(current_user, db)
    db_integration = db.query(EmailIntegration).filter(
        EmailIntegration.id == integration_id,
        EmailIntegration.organization_id == org.id
    ).first()

    if not db_integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    db.delete(db_integration)
    db.commit()
    return {"message": "Integration deleted"}


# ============ Social Account Connections ============

@router.get("/social-accounts")
def get_social_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get connected social media accounts."""
    org = get_user_organization(current_user, db)

    connections = db.query(OAuthConnection).filter(
        OAuthConnection.organization_id == org.id,
        OAuthConnection.provider.in_(['twitter', 'linkedin', 'facebook', 'instagram'])
    ).all()

    return [
        {
            'id': conn.id,
            'provider': conn.provider,
            'account_name': conn.account_name,
            'connected_at': conn.created_at,
            'is_active': conn.access_token is not None
        }
        for conn in connections
    ]


# ============ Analytics ============

@router.get("/analytics/summary", response_model=AnalyticsSummary)
def get_analytics_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get marketing analytics summary."""
    org = get_user_organization(current_user, db)

    # Get email analytics
    email_stats = db.query(EmailAnalytics).filter(
        EmailAnalytics.organization_id == org.id
    ).all()

    total_sent = sum(e.sent_count or 0 for e in email_stats)
    total_opens = sum(e.open_count or 0 for e in email_stats)
    total_clicks = sum(e.click_count or 0 for e in email_stats)

    # Get social analytics
    social_stats = db.query(SocialAnalytics).filter(
        SocialAnalytics.organization_id == org.id
    ).all()

    total_impressions = sum(s.impressions or 0 for s in social_stats)
    total_engagements = sum((s.likes or 0) + (s.comments or 0) + (s.shares or 0) for s in social_stats)
    total_social_clicks = sum(s.clicks or 0 for s in social_stats)

    return AnalyticsSummary(
        total_emails_sent=total_sent,
        total_opens=total_opens,
        total_clicks=total_clicks,
        open_rate=round((total_opens / total_sent * 100) if total_sent > 0 else 0, 2),
        click_rate=round((total_clicks / total_sent * 100) if total_sent > 0 else 0, 2),
        social_impressions=total_impressions,
        social_engagements=total_engagements,
        social_clicks=total_social_clicks
    )


# ============ Pre-built Templates ============

PREBUILT_TEMPLATES = [
    {
        'name': 'Welcome Email',
        'template_type': 'welcome',
        'subject': 'Welcome to {{company_name}}!',
        'html_content': '''
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #06b6d4, #3b82f6); padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; }
        .content { background: #f9fafb; padding: 40px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background: #06b6d4; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome, {{first_name}}!</h1>
        </div>
        <div class="content">
            <p>We're thrilled to have you join {{company_name}}.</p>
            <p>Here's what you can do next:</p>
            <ul>
                <li>Complete your profile</li>
                <li>Explore our features</li>
                <li>Connect with our community</li>
            </ul>
            <a href="{{dashboard_url}}" class="button">Get Started</a>
        </div>
        <div class="footer">
            <p>&copy; {{year}} {{company_name}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        ''',
        'variables': json.dumps(['first_name', 'company_name', 'dashboard_url', 'year'])
    },
    {
        'name': 'Newsletter',
        'template_type': 'newsletter',
        'subject': '{{company_name}} Newsletter - {{month}} {{year}}',
        'html_content': '''
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: #1f2937; padding: 30px; text-align: center; }
        .header img { max-height: 40px; }
        .content { padding: 40px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #1f2937; border-bottom: 2px solid #06b6d4; padding-bottom: 10px; }
        .article { display: flex; gap: 20px; margin-bottom: 20px; }
        .article img { width: 120px; height: 80px; object-fit: cover; border-radius: 4px; }
        .button { display: inline-block; padding: 10px 20px; background: #06b6d4; color: white; text-decoration: none; border-radius: 4px; }
        .footer { background: #1f2937; color: #9ca3af; padding: 30px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: white; margin: 0;">{{company_name}}</h1>
        </div>
        <div class="content">
            <p>Hi {{first_name}},</p>
            <p>Here's what's new this month:</p>

            <div class="section">
                <h2>Featured Update</h2>
                <p>{{featured_content}}</p>
                <a href="{{cta_url}}" class="button">Learn More</a>
            </div>

            <div class="section">
                <h2>Quick Links</h2>
                <ul>
                    <li><a href="#">Blog</a></li>
                    <li><a href="#">Documentation</a></li>
                    <li><a href="#">Support</a></li>
                </ul>
            </div>
        </div>
        <div class="footer">
            <p>You received this email because you subscribed to our newsletter.</p>
            <p><a href="{{unsubscribe_url}}" style="color: #9ca3af;">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
        ''',
        'variables': json.dumps(['first_name', 'company_name', 'month', 'year', 'featured_content', 'cta_url', 'unsubscribe_url'])
    },
    {
        'name': 'Product Announcement',
        'template_type': 'announcement',
        'subject': 'Introducing {{feature_name}} - {{company_name}}',
        'html_content': '''
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .hero { background: linear-gradient(135deg, #8b5cf6, #06b6d4); padding: 60px 40px; text-align: center; border-radius: 12px; }
        .hero h1 { color: white; font-size: 28px; margin: 0 0 10px; }
        .hero p { color: rgba(255,255,255,0.9); font-size: 16px; margin: 0; }
        .content { padding: 40px 0; }
        .feature { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; }
        .feature-icon { width: 50px; height: 50px; background: #f0f9ff; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .button { display: inline-block; padding: 14px 28px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <h1>Introducing {{feature_name}}</h1>
            <p>{{feature_tagline}}</p>
        </div>
        <div class="content">
            <p>Hi {{first_name}},</p>
            <p>We're excited to announce {{feature_name}} - a powerful new way to {{feature_benefit}}.</p>

            <h3>What's New:</h3>
            <div class="feature">
                <div class="feature-icon">✨</div>
                <div>
                    <strong>{{benefit_1_title}}</strong>
                    <p style="margin: 5px 0 0; color: #6b7280;">{{benefit_1_desc}}</p>
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <a href="{{cta_url}}" class="button">Try It Now</a>
            </div>
        </div>
        <div class="footer">
            <p>&copy; {{year}} {{company_name}}</p>
        </div>
    </div>
</body>
</html>
        ''',
        'variables': json.dumps(['first_name', 'company_name', 'feature_name', 'feature_tagline', 'feature_benefit', 'benefit_1_title', 'benefit_1_desc', 'cta_url', 'year'])
    }
]


@router.get("/templates/prebuilt")
def get_prebuilt_templates(
    current_user: User = Depends(get_current_user)
):
    """Get list of available pre-built templates."""
    return [
        {
            'name': t['name'],
            'template_type': t['template_type'],
            'subject': t['subject'],
            'preview': t['html_content'][:500] + '...'
        }
        for t in PREBUILT_TEMPLATES
    ]


@router.post("/templates/prebuilt/{template_name}", response_model=EmailTemplateResponse)
def use_prebuilt_template(
    template_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new template from a pre-built template."""
    org = get_user_organization(current_user, db)

    template = next((t for t in PREBUILT_TEMPLATES if t['name'] == template_name), None)
    if not template:
        raise HTTPException(status_code=404, detail="Pre-built template not found")

    db_template = EmailTemplate(
        organization_id=org.id,
        name=template['name'],
        template_type=template['template_type'],
        subject=template['subject'],
        html_content=template['html_content'],
        variables=template['variables']
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template
