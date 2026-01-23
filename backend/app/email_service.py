"""
Email service using AWS SES for transactional emails.

Features:
- Email verification
- Password reset
- Login notifications (future)
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Configuration
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@made4founders.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
APP_NAME = "Made4Founders"
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Lazy import boto3 to handle missing dependency gracefully
_ses_client = None


def _get_ses_client():
    """Lazy load SES client."""
    global _ses_client
    if _ses_client is None:
        try:
            import boto3
            _ses_client = boto3.client('ses', region_name=AWS_REGION)
        except ImportError:
            logger.warning("boto3 package not installed. Email sending disabled.")
            return None
        except Exception as e:
            logger.error(f"Failed to create SES client: {e}")
            return None
    return _ses_client


def _send_email(to: str, subject: str, html: str) -> bool:
    """Send email via AWS SES."""
    ses = _get_ses_client()
    if not ses:
        return False

    try:
        ses.send_email(
            Source=f"{APP_NAME} <{FROM_EMAIL}>",
            Destination={'ToAddresses': [to]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html, 'Charset': 'UTF-8'}}
            }
        )
        return True
    except Exception as e:
        logger.error(f"SES send error: {e}")
        return False


async def send_verification_email(email: str, token: str, name: Optional[str] = None) -> bool:
    """
    Send email verification link to user.

    Args:
        email: User's email address
        token: Verification token
        name: User's name (optional)

    Returns:
        True if email sent successfully, False otherwise
    """
    verification_url = f"{FRONTEND_URL}/verify-email?token={token}"
    greeting = f"Hi {name}," if name else "Hi there,"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Welcome to {APP_NAME}!</h2>
        <p>{greeting}</p>
        <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{verification_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
                Verify Email Address
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">{verification_url}</p>
        <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">If you didn't create an account with {APP_NAME}, please ignore this email.</p>
    </body>
    </html>
    """

    subject = f"Verify your {APP_NAME} email"
    success = _send_email(email, subject, html_content)
    if success:
        logger.info(f"Verification email sent to {email}")
    else:
        logger.error(f"Failed to send verification email to {email}")
    return success


async def send_password_reset_email(email: str, token: str, name: Optional[str] = None) -> bool:
    """
    Send password reset link to user.

    Args:
        email: User's email address
        token: Reset token
        name: User's name (optional)

    Returns:
        True if email sent successfully, False otherwise
    """
    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
    greeting = f"Hi {name}," if name else "Hi there,"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>{greeting}</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
                Reset Password
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">{reset_url}</p>
        <p style="color: #666; font-size: 14px;"><strong>This link expires in 1 hour.</strong></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">If you didn't request a password reset, please ignore this email or contact support if you have concerns. Your password will remain unchanged.</p>
    </body>
    </html>
    """

    subject = f"Reset your {APP_NAME} password"
    success = _send_email(email, subject, html_content)
    if success:
        logger.info(f"Password reset email sent to {email}")
    else:
        logger.error(f"Failed to send password reset email to {email}")
    return success


async def send_login_alert_email(
    email: str,
    name: Optional[str] = None,
    device_info: Optional[str] = None,
    ip_address: Optional[str] = None,
    location: Optional[str] = None
) -> bool:
    """
    Send login notification email (for suspicious activity detection).

    Args:
        email: User's email address
        name: User's name (optional)
        device_info: Browser/device information
        ip_address: IP address of login
        location: Approximate location (future feature)

    Returns:
        True if email sent successfully, False otherwise
    """
    greeting = f"Hi {name}," if name else "Hi there,"
    device_str = device_info or "Unknown device"
    ip_str = ip_address or "Unknown IP"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">New Login Detected</h2>
        <p>{greeting}</p>
        <p>We noticed a new login to your {APP_NAME} account:</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Device:</strong> {device_str}</p>
            <p style="margin: 8px 0 0 0;"><strong>IP Address:</strong> {ip_str}</p>
        </div>
        <p>If this was you, you can ignore this email.</p>
        <p>If you didn't log in, please secure your account immediately by changing your password and enabling two-factor authentication.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">{APP_NAME} Security Team</p>
    </body>
    </html>
    """

    subject = f"New login to your {APP_NAME} account"
    success = _send_email(email, subject, html_content)
    if success:
        logger.info(f"Login alert email sent to {email}")
    else:
        logger.error(f"Failed to send login alert email to {email}")
    return success
