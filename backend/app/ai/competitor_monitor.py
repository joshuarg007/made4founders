"""
Competitor Monitoring Module.

Tracks competitor news and updates via NewsAPI and RSS feeds.
"""

import os
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

import aiohttp
import feedparser

logger = logging.getLogger(__name__)


class NewsAPIClient:
    """Client for NewsAPI.org."""

    BASE_URL = "https://newsapi.org/v2"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("NEWS_API_KEY")

    async def search(
        self,
        query: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        language: str = "en",
        sort_by: str = "relevancy",
        page_size: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for news articles.

        Args:
            query: Search query
            from_date: Start date for articles
            to_date: End date for articles
            language: Language code
            sort_by: Sort order (relevancy, popularity, publishedAt)
            page_size: Number of results

        Returns:
            List of article dicts
        """
        if not self.api_key:
            logger.warning("NEWS_API_KEY not configured")
            return []

        params = {
            "q": query,
            "language": language,
            "sortBy": sort_by,
            "pageSize": page_size,
            "apiKey": self.api_key
        }

        if from_date:
            params["from"] = from_date.strftime("%Y-%m-%d")
        if to_date:
            params["to"] = to_date.strftime("%Y-%m-%d")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.BASE_URL}/everything",
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("articles", [])
                    else:
                        error = await response.text()
                        logger.error(f"NewsAPI error: {response.status} - {error}")
                        return []

        except asyncio.TimeoutError:
            logger.error("NewsAPI request timed out")
            return []
        except Exception as e:
            logger.error(f"NewsAPI error: {e}")
            return []


async def parse_rss_feed(url: str) -> List[Dict[str, Any]]:
    """
    Parse an RSS feed and return entries.

    Args:
        url: RSS feed URL

    Returns:
        List of feed entry dicts
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status != 200:
                    logger.warning(f"RSS feed returned {response.status}: {url}")
                    return []

                content = await response.text()
                feed = feedparser.parse(content)

                entries = []
                for entry in feed.entries[:20]:  # Limit to 20 entries
                    entries.append({
                        "title": entry.get("title", ""),
                        "summary": entry.get("summary", ""),
                        "link": entry.get("link", ""),
                        "published": entry.get("published", ""),
                        "source": feed.feed.get("title", url)
                    })

                return entries

    except asyncio.TimeoutError:
        logger.warning(f"RSS feed timed out: {url}")
        return []
    except Exception as e:
        logger.error(f"RSS feed error for {url}: {e}")
        return []


class CompetitorMonitor:
    """Monitor competitors for news and updates."""

    def __init__(self, news_api_key: Optional[str] = None):
        self.news_client = NewsAPIClient(news_api_key)

    async def fetch_competitor_updates(
        self,
        competitor_name: str,
        keywords: Optional[List[str]] = None,
        rss_urls: Optional[List[str]] = None,
        days_back: int = 7
    ) -> Dict[str, Any]:
        """
        Fetch updates for a competitor from multiple sources.

        Args:
            competitor_name: Name of the competitor
            keywords: Additional keywords to search
            rss_urls: RSS feeds to monitor
            days_back: How many days back to search

        Returns:
            Dict with news and rss_entries
        """
        from_date = datetime.utcnow() - timedelta(days=days_back)

        # Build search query
        query = competitor_name
        if keywords:
            query = f'"{competitor_name}" OR ' + ' OR '.join(f'"{kw}"' for kw in keywords[:3])

        # Fetch from NewsAPI and RSS feeds in parallel
        tasks = []

        # NewsAPI task
        tasks.append(self.news_client.search(
            query=query,
            from_date=from_date,
            page_size=10
        ))

        # RSS tasks
        for url in (rss_urls or [])[:5]:  # Limit to 5 RSS feeds
            tasks.append(parse_rss_feed(url))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        news_articles = []
        rss_entries = []

        if not isinstance(results[0], Exception):
            news_articles = results[0]

        for i, result in enumerate(results[1:]):
            if not isinstance(result, Exception):
                rss_entries.extend(result)

        return {
            "news": news_articles,
            "rss_entries": rss_entries
        }

    async def analyze_updates(
        self,
        competitor_name: str,
        updates: Dict[str, Any],
        user_focus: str = "",
        db=None,
        organization_id: int = None
    ) -> Dict[str, Any]:
        """
        Analyze competitor updates with AI.

        Args:
            competitor_name: Name of the competitor
            updates: Dict with news and rss_entries
            user_focus: User's business focus for relevance scoring
            db: Database session for provider preferences
            organization_id: Organization ID for preferences

        Returns:
            Analysis results
        """
        from .llm_client import parse_json_response
        from .providers import get_fallback_client
        from .prompts import COMPETITOR_PROMPTS

        all_articles = updates.get("news", []) + updates.get("rss_entries", [])

        if not all_articles:
            return {
                "summary": f"No recent updates found for {competitor_name}",
                "key_developments": [],
                "recommended_actions": [],
                "overall_threat_level": "low"
            }

        # Format articles for prompt
        articles_text = ""
        for i, article in enumerate(all_articles[:10]):  # Limit to 10 articles
            title = article.get("title", "")
            summary = article.get("summary", article.get("description", ""))[:200]
            source = article.get("source", {})
            source_name = source.get("name", "") if isinstance(source, dict) else source
            articles_text += f"\n{i+1}. [{source_name}] {title}\n   {summary}\n"

        prompt = COMPETITOR_PROMPTS["analyze_news"].format(
            competitor_name=competitor_name,
            user_focus=user_focus or "general business operations",
            articles=articles_text
        )

        # Use fallback client with preference for local (cost savings)
        client = get_fallback_client(db, organization_id, prefer_local=True)
        response = await client.generate(
            prompt=prompt,
            temperature=0.3,
            max_tokens=1024
        )

        if not response.success:
            return {
                "summary": f"Found {len(all_articles)} updates for {competitor_name}",
                "key_developments": [{"title": a.get("title", ""), "description": ""} for a in all_articles[:5]],
                "recommended_actions": [],
                "overall_threat_level": "unknown"
            }

        parsed = parse_json_response(response.content)

        if parsed:
            return parsed

        return {
            "summary": response.content[:500],
            "key_developments": [],
            "recommended_actions": [],
            "overall_threat_level": "unknown"
        }


def calculate_relevance_score(
    article_title: str,
    article_content: str,
    keywords: List[str]
) -> float:
    """
    Calculate relevance score for an article based on keywords.

    Returns a score from 0.0 to 1.0.
    """
    text = (article_title + " " + article_content).lower()
    matches = 0
    total_keywords = len(keywords) or 1

    for keyword in keywords:
        if keyword.lower() in text:
            matches += 1

    return min(1.0, matches / total_keywords)


def detect_sentiment(text: str) -> str:
    """
    Simple sentiment detection based on keywords.

    Returns: "positive", "neutral", or "negative"
    """
    text_lower = text.lower()

    positive_words = [
        'growth', 'success', 'launch', 'new', 'innovation', 'partnership',
        'expansion', 'wins', 'award', 'record', 'milestone'
    ]
    negative_words = [
        'layoff', 'cuts', 'loss', 'decline', 'lawsuit', 'controversy',
        'failure', 'shutdown', 'closing', 'problem', 'issue', 'delay'
    ]

    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)

    if positive_count > negative_count:
        return "positive"
    elif negative_count > positive_count:
        return "negative"
    return "neutral"


def classify_update_type(title: str, content: str) -> str:
    """
    Classify the type of competitor update.

    Returns: news, product, funding, hiring, partnership, or other
    """
    text = (title + " " + content).lower()

    if any(w in text for w in ['funding', 'raised', 'investment', 'valuation', 'series']):
        return 'funding'
    if any(w in text for w in ['launch', 'release', 'product', 'feature', 'update', 'version']):
        return 'product'
    if any(w in text for w in ['hire', 'hiring', 'job', 'ceo', 'cto', 'executive', 'team']):
        return 'hiring'
    if any(w in text for w in ['partner', 'collaboration', 'integration', 'alliance']):
        return 'partnership'

    return 'news'
