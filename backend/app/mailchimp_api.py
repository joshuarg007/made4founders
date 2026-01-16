"""
Mailchimp API integration for email marketing campaigns.
"""

import httpx
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import hashlib


class MailchimpClient:
    """Client for interacting with Mailchimp API v3."""

    def __init__(self, api_key: str):
        """
        Initialize Mailchimp client.

        Args:
            api_key: Mailchimp API key in format 'key-dc' where dc is the data center
        """
        self.api_key = api_key
        # Extract data center from API key (last part after -)
        self.dc = api_key.split('-')[-1] if '-' in api_key else 'us1'
        self.base_url = f"https://{self.dc}.api.mailchimp.com/3.0"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make an authenticated request to the Mailchimp API."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                params=params,
                timeout=30.0
            )

            if response.status_code >= 400:
                error_detail = response.json() if response.content else {}
                raise MailchimpAPIError(
                    status_code=response.status_code,
                    detail=error_detail.get('detail', 'Unknown error'),
                    type=error_detail.get('type', 'error')
                )

            return response.json() if response.content else {}

    # ============ Account ============

    async def get_account_info(self) -> Dict[str, Any]:
        """Get information about the authenticated account."""
        return await self._request("GET", "/")

    # ============ Lists (Audiences) ============

    async def get_lists(self, count: int = 10, offset: int = 0) -> Dict[str, Any]:
        """Get all lists/audiences."""
        return await self._request("GET", "/lists", params={"count": count, "offset": offset})

    async def get_list(self, list_id: str) -> Dict[str, Any]:
        """Get a specific list."""
        return await self._request("GET", f"/lists/{list_id}")

    async def get_list_members(
        self,
        list_id: str,
        count: int = 100,
        offset: int = 0,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get members of a list."""
        params = {"count": count, "offset": offset}
        if status:
            params["status"] = status
        return await self._request("GET", f"/lists/{list_id}/members", params=params)

    async def add_list_member(
        self,
        list_id: str,
        email: str,
        status: str = "subscribed",
        merge_fields: Optional[Dict] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Add a member to a list."""
        data = {
            "email_address": email,
            "status": status
        }
        if merge_fields:
            data["merge_fields"] = merge_fields
        if tags:
            data["tags"] = tags

        return await self._request("POST", f"/lists/{list_id}/members", data=data)

    async def update_list_member(
        self,
        list_id: str,
        email: str,
        status: Optional[str] = None,
        merge_fields: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Update a list member."""
        subscriber_hash = self._get_subscriber_hash(email)
        data = {}
        if status:
            data["status"] = status
        if merge_fields:
            data["merge_fields"] = merge_fields

        return await self._request("PATCH", f"/lists/{list_id}/members/{subscriber_hash}", data=data)

    async def delete_list_member(self, list_id: str, email: str) -> None:
        """Delete a member from a list (permanent)."""
        subscriber_hash = self._get_subscriber_hash(email)
        await self._request("DELETE", f"/lists/{list_id}/members/{subscriber_hash}")

    # ============ Campaigns ============

    async def get_campaigns(
        self,
        count: int = 10,
        offset: int = 0,
        status: Optional[str] = None,
        type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get campaigns."""
        params = {"count": count, "offset": offset}
        if status:
            params["status"] = status
        if type:
            params["type"] = type
        return await self._request("GET", "/campaigns", params=params)

    async def get_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Get a specific campaign."""
        return await self._request("GET", f"/campaigns/{campaign_id}")

    async def create_campaign(
        self,
        list_id: str,
        subject: str,
        from_name: str,
        reply_to: str,
        title: Optional[str] = None,
        campaign_type: str = "regular"
    ) -> Dict[str, Any]:
        """Create a new campaign."""
        data = {
            "type": campaign_type,
            "recipients": {
                "list_id": list_id
            },
            "settings": {
                "subject_line": subject,
                "from_name": from_name,
                "reply_to": reply_to,
                "title": title or subject
            }
        }
        return await self._request("POST", "/campaigns", data=data)

    async def update_campaign(
        self,
        campaign_id: str,
        subject: Optional[str] = None,
        from_name: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update campaign settings."""
        data = {"settings": {}}
        if subject:
            data["settings"]["subject_line"] = subject
        if from_name:
            data["settings"]["from_name"] = from_name
        if reply_to:
            data["settings"]["reply_to"] = reply_to

        return await self._request("PATCH", f"/campaigns/{campaign_id}", data=data)

    async def set_campaign_content(
        self,
        campaign_id: str,
        html: str,
        plain_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """Set campaign content."""
        data = {"html": html}
        if plain_text:
            data["plain_text"] = plain_text

        return await self._request("PUT", f"/campaigns/{campaign_id}/content", data=data)

    async def send_campaign(self, campaign_id: str) -> None:
        """Send a campaign immediately."""
        await self._request("POST", f"/campaigns/{campaign_id}/actions/send")

    async def schedule_campaign(
        self,
        campaign_id: str,
        schedule_time: datetime
    ) -> None:
        """Schedule a campaign to be sent at a specific time."""
        data = {
            "schedule_time": schedule_time.isoformat()
        }
        await self._request("POST", f"/campaigns/{campaign_id}/actions/schedule", data=data)

    async def delete_campaign(self, campaign_id: str) -> None:
        """Delete a campaign."""
        await self._request("DELETE", f"/campaigns/{campaign_id}")

    # ============ Reports ============

    async def get_campaign_report(self, campaign_id: str) -> Dict[str, Any]:
        """Get campaign report/analytics."""
        return await self._request("GET", f"/reports/{campaign_id}")

    async def get_campaign_open_details(
        self,
        campaign_id: str,
        count: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get campaign open activity."""
        return await self._request(
            "GET",
            f"/reports/{campaign_id}/open-details",
            params={"count": count, "offset": offset}
        )

    async def get_campaign_click_details(
        self,
        campaign_id: str,
        count: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get campaign click activity."""
        return await self._request(
            "GET",
            f"/reports/{campaign_id}/click-details",
            params={"count": count, "offset": offset}
        )

    # ============ Templates ============

    async def get_templates(self, count: int = 10, offset: int = 0) -> Dict[str, Any]:
        """Get templates."""
        return await self._request("GET", "/templates", params={"count": count, "offset": offset})

    async def create_template(self, name: str, html: str) -> Dict[str, Any]:
        """Create a new template."""
        data = {
            "name": name,
            "html": html
        }
        return await self._request("POST", "/templates", data=data)

    async def delete_template(self, template_id: str) -> None:
        """Delete a template."""
        await self._request("DELETE", f"/templates/{template_id}")

    # ============ Tags ============

    async def get_list_tags(self, list_id: str) -> Dict[str, Any]:
        """Get all tags for a list."""
        return await self._request("GET", f"/lists/{list_id}/tag-search")

    async def add_member_tags(
        self,
        list_id: str,
        email: str,
        tags: List[str]
    ) -> None:
        """Add tags to a list member."""
        subscriber_hash = self._get_subscriber_hash(email)
        data = {
            "tags": [{"name": tag, "status": "active"} for tag in tags]
        }
        await self._request("POST", f"/lists/{list_id}/members/{subscriber_hash}/tags", data=data)

    async def remove_member_tags(
        self,
        list_id: str,
        email: str,
        tags: List[str]
    ) -> None:
        """Remove tags from a list member."""
        subscriber_hash = self._get_subscriber_hash(email)
        data = {
            "tags": [{"name": tag, "status": "inactive"} for tag in tags]
        }
        await self._request("POST", f"/lists/{list_id}/members/{subscriber_hash}/tags", data=data)

    # ============ Helpers ============

    @staticmethod
    def _get_subscriber_hash(email: str) -> str:
        """Get MD5 hash of lowercase email (used as subscriber ID)."""
        return hashlib.md5(email.lower().encode()).hexdigest()


class MailchimpAPIError(Exception):
    """Exception for Mailchimp API errors."""

    def __init__(self, status_code: int, detail: str, type: str):
        self.status_code = status_code
        self.detail = detail
        self.type = type
        super().__init__(f"Mailchimp API Error ({status_code}): {detail}")


# ============ FastAPI Routes for Mailchimp ============

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, EmailIntegration
from .auth import get_current_user

mailchimp_router = APIRouter()


async def get_mailchimp_client(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> MailchimpClient:
    """Get an authenticated Mailchimp client for the user's organization."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="No organization")

    integration = db.query(EmailIntegration).filter(
        EmailIntegration.organization_id == current_user.organization_id,
        EmailIntegration.provider == "mailchimp",
        EmailIntegration.is_active == True
    ).first()

    if not integration:
        raise HTTPException(status_code=404, detail="Mailchimp integration not configured")

    return MailchimpClient(integration.api_key)


@mailchimp_router.get("/account")
async def get_mailchimp_account(
    client: MailchimpClient = Depends(get_mailchimp_client)
):
    """Get Mailchimp account information."""
    try:
        return await client.get_account_info()
    except MailchimpAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@mailchimp_router.get("/lists")
async def get_mailchimp_lists(
    count: int = 10,
    offset: int = 0,
    client: MailchimpClient = Depends(get_mailchimp_client)
):
    """Get Mailchimp lists/audiences."""
    try:
        return await client.get_lists(count=count, offset=offset)
    except MailchimpAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@mailchimp_router.get("/lists/{list_id}/members")
async def get_list_members(
    list_id: str,
    count: int = 100,
    offset: int = 0,
    status: Optional[str] = None,
    client: MailchimpClient = Depends(get_mailchimp_client)
):
    """Get members of a Mailchimp list."""
    try:
        return await client.get_list_members(list_id, count=count, offset=offset, status=status)
    except MailchimpAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


class AddMemberRequest(BaseModel):
    email: str
    status: str = "subscribed"
    merge_fields: Optional[Dict] = None
    tags: Optional[List[str]] = None


@mailchimp_router.post("/lists/{list_id}/members")
async def add_list_member(
    list_id: str,
    request: AddMemberRequest,
    client: MailchimpClient = Depends(get_mailchimp_client)
):
    """Add a member to a Mailchimp list."""
    try:
        return await client.add_list_member(
            list_id,
            email=request.email,
            status=request.status,
            merge_fields=request.merge_fields,
            tags=request.tags
        )
    except MailchimpAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@mailchimp_router.get("/campaigns")
async def get_mailchimp_campaigns(
    count: int = 10,
    offset: int = 0,
    status: Optional[str] = None,
    client: MailchimpClient = Depends(get_mailchimp_client)
):
    """Get Mailchimp campaigns."""
    try:
        return await client.get_campaigns(count=count, offset=offset, status=status)
    except MailchimpAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


class CreateCampaignRequest(BaseModel):
    list_id: str
    subject: str
    from_name: str
    reply_to: str
    title: Optional[str] = None


@mailchimp_router.post("/campaigns")
async def create_mailchimp_campaign(
    request: CreateCampaignRequest,
    client: MailchimpClient = Depends(get_mailchimp_client)
):
    """Create a new Mailchimp campaign."""
    try:
        return await client.create_campaign(
            list_id=request.list_id,
            subject=request.subject,
            from_name=request.from_name,
            reply_to=request.reply_to,
            title=request.title
        )
    except MailchimpAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


class SetCampaignContentRequest(BaseModel):
    html: str
    plain_text: Optional[str] = None


@mailchimp_router.put("/campaigns/{campaign_id}/content")
async def set_campaign_content(
    campaign_id: str,
    request: SetCampaignContentRequest,
    client: MailchimpClient = Depends(get_mailchimp_client)
):
    """Set content for a Mailchimp campaign."""
    try:
        return await client.set_campaign_content(
            campaign_id,
            html=request.html,
            plain_text=request.plain_text
        )
    except MailchimpAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@mailchimp_router.post("/campaigns/{campaign_id}/send")
async def send_campaign(
    campaign_id: str,
    client: MailchimpClient = Depends(get_mailchimp_client)
):
    """Send a Mailchimp campaign immediately."""
    try:
        await client.send_campaign(campaign_id)
        return {"message": "Campaign sent"}
    except MailchimpAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@mailchimp_router.get("/reports/{campaign_id}")
async def get_campaign_report(
    campaign_id: str,
    client: MailchimpClient = Depends(get_mailchimp_client)
):
    """Get report for a Mailchimp campaign."""
    try:
        return await client.get_campaign_report(campaign_id)
    except MailchimpAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
