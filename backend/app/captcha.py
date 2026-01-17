"""
Captcha verification module.
Supports hCaptcha and reCAPTCHA v2/v3.
"""
import os
import httpx
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# hCaptcha settings
HCAPTCHA_SECRET = os.getenv("HCAPTCHA_SECRET", "")
HCAPTCHA_SITE_KEY = os.getenv("HCAPTCHA_SITE_KEY", "")
HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify"

# reCAPTCHA settings (alternative)
RECAPTCHA_SECRET = os.getenv("RECAPTCHA_SECRET", "")
RECAPTCHA_SITE_KEY = os.getenv("RECAPTCHA_SITE_KEY", "")
RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"

# Which captcha provider to use
CAPTCHA_PROVIDER = os.getenv("CAPTCHA_PROVIDER", "hcaptcha")  # hcaptcha or recaptcha
CAPTCHA_ENABLED = os.getenv("CAPTCHA_ENABLED", "false").lower() == "true"


async def verify_captcha(token: str, remote_ip: Optional[str] = None) -> bool:
    """
    Verify a captcha token with the configured provider.

    Args:
        token: The captcha response token from the frontend
        remote_ip: Optional client IP address

    Returns:
        True if verification succeeds, False otherwise
    """
    if not CAPTCHA_ENABLED:
        logger.debug("Captcha verification skipped (disabled)")
        return True

    if not token:
        logger.warning("Captcha token is empty")
        return False

    try:
        if CAPTCHA_PROVIDER == "hcaptcha":
            return await verify_hcaptcha(token, remote_ip)
        elif CAPTCHA_PROVIDER == "recaptcha":
            return await verify_recaptcha(token, remote_ip)
        else:
            logger.error(f"Unknown captcha provider: {CAPTCHA_PROVIDER}")
            return False
    except Exception as e:
        logger.error(f"Captcha verification error: {e}")
        # Fail open or closed based on preference
        # For security, fail closed (return False)
        return False


async def verify_hcaptcha(token: str, remote_ip: Optional[str] = None) -> bool:
    """Verify hCaptcha token."""
    if not HCAPTCHA_SECRET:
        logger.warning("hCaptcha secret not configured")
        return True  # Skip if not configured

    data = {
        "secret": HCAPTCHA_SECRET,
        "response": token,
    }
    if remote_ip:
        data["remoteip"] = remote_ip

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(HCAPTCHA_VERIFY_URL, data=data)
        result = response.json()

    success = result.get("success", False)
    if not success:
        logger.warning(f"hCaptcha verification failed: {result.get('error-codes', [])}")

    return success


async def verify_recaptcha(token: str, remote_ip: Optional[str] = None) -> bool:
    """Verify reCAPTCHA token."""
    if not RECAPTCHA_SECRET:
        logger.warning("reCAPTCHA secret not configured")
        return True  # Skip if not configured

    data = {
        "secret": RECAPTCHA_SECRET,
        "response": token,
    }
    if remote_ip:
        data["remoteip"] = remote_ip

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(RECAPTCHA_VERIFY_URL, data=data)
        result = response.json()

    success = result.get("success", False)
    if not success:
        logger.warning(f"reCAPTCHA verification failed: {result.get('error-codes', [])}")

    # For reCAPTCHA v3, also check the score
    score = result.get("score")
    if score is not None and score < 0.5:
        logger.warning(f"reCAPTCHA score too low: {score}")
        return False

    return success


def get_captcha_config() -> dict:
    """Get captcha configuration for the frontend."""
    if not CAPTCHA_ENABLED:
        return {"enabled": False}

    if CAPTCHA_PROVIDER == "hcaptcha":
        return {
            "enabled": True,
            "provider": "hcaptcha",
            "siteKey": HCAPTCHA_SITE_KEY,
        }
    elif CAPTCHA_PROVIDER == "recaptcha":
        return {
            "enabled": True,
            "provider": "recaptcha",
            "siteKey": RECAPTCHA_SITE_KEY,
        }

    return {"enabled": False}
