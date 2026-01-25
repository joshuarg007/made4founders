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


async def send_deadline_reminder_email(
    email: str,
    name: Optional[str] = None,
    deadlines: list = None,
    reminder_type: str = "today"  # "today", "tomorrow", "week"
) -> bool:
    """
    Send deadline reminder email.

    Args:
        email: User's email address
        name: User's name (optional)
        deadlines: List of deadline dicts with 'title', 'due_date', 'category'
        reminder_type: Type of reminder (today, tomorrow, week)

    Returns:
        True if email sent successfully, False otherwise
    """
    if not deadlines:
        return True  # Nothing to send

    greeting = f"Hi {name}," if name else "Hi there,"

    # Determine subject and intro text
    if reminder_type == "today":
        subject = f"{len(deadlines)} deadline(s) due TODAY - {APP_NAME}"
        intro = "You have deadlines due <strong>today</strong>:"
        urgency_color = "#ef4444"  # red
    elif reminder_type == "tomorrow":
        subject = f"{len(deadlines)} deadline(s) due tomorrow - {APP_NAME}"
        intro = "You have deadlines due <strong>tomorrow</strong>:"
        urgency_color = "#f59e0b"  # amber
    else:  # week
        subject = f"{len(deadlines)} deadline(s) coming up this week - {APP_NAME}"
        intro = "You have deadlines due <strong>this week</strong>:"
        urgency_color = "#3b82f6"  # blue

    # Build deadline list HTML
    deadline_items = ""
    for d in deadlines:
        due_str = d.get('due_date', 'Unknown date')
        category = d.get('category', '')
        category_badge = f'<span style="background-color: rgba(59,130,246,0.2); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">{category}</span>' if category else ''
        deadline_items += f'''
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #2d3748;">
                <div style="font-weight: 500; color: #f3f4f6;">{d.get('title', 'Untitled')}{category_badge}</div>
                <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">Due: {due_str}</div>
            </td>
        </tr>
        '''

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #e5e7eb; background-color: #0f1117; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1a1d24; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
            <div style="padding: 24px 24px 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <h2 style="color: {urgency_color}; margin: 0 0 8px 0; font-size: 20px;">Deadline Reminder</h2>
                <p style="margin: 0; color: #9ca3af;">{greeting}</p>
            </div>
            <div style="padding: 16px 24px;">
                <p style="margin: 0 0 16px 0;">{intro}</p>
                <table style="width: 100%; border-collapse: collapse; background-color: #13151a; border-radius: 8px; overflow: hidden;">
                    {deadline_items}
                </table>
            </div>
            <div style="padding: 16px 24px 24px 24px;">
                <a href="{FRONTEND_URL}/app/deadlines" style="display: inline-block; background: linear-gradient(to right, #06b6d4, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">
                    View All Deadlines
                </a>
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.1); background-color: #13151a;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                    You received this email because you have deadline reminders enabled in your {APP_NAME} settings.
                    <a href="{FRONTEND_URL}/app/settings" style="color: #60a5fa;">Manage preferences</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    success = _send_email(email, subject, html_content)
    if success:
        logger.info(f"Deadline reminder ({reminder_type}) sent to {email}")
    else:
        logger.error(f"Failed to send deadline reminder ({reminder_type}) to {email}")
    return success


async def send_weekly_digest_email(
    email: str,
    name: Optional[str] = None,
    stats: dict = None
) -> bool:
    """
    Send weekly digest email with business summary.

    Args:
        email: User's email address
        name: User's name (optional)
        stats: Dict with 'tasks_completed', 'deadlines_met', 'upcoming_deadlines', etc.

    Returns:
        True if email sent successfully, False otherwise
    """
    if not stats:
        stats = {}

    greeting = f"Hi {name}," if name else "Hi there,"
    tasks_completed = stats.get('tasks_completed', 0)
    deadlines_met = stats.get('deadlines_met', 0)
    upcoming_deadlines = stats.get('upcoming_deadlines', 0)
    xp_earned = stats.get('xp_earned', 0)

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #e5e7eb; background-color: #0f1117; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1a1d24; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
            <div style="padding: 24px 24px 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <h2 style="color: #22d3ee; margin: 0 0 8px 0; font-size: 20px;">Your Weekly Summary</h2>
                <p style="margin: 0; color: #9ca3af;">{greeting} Here's how your week went.</p>
            </div>
            <div style="padding: 16px 24px;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    <div style="background-color: #13151a; border-radius: 8px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #22d3ee;">{tasks_completed}</div>
                        <div style="font-size: 13px; color: #9ca3af;">Tasks Completed</div>
                    </div>
                    <div style="background-color: #13151a; border-radius: 8px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #10b981;">{deadlines_met}</div>
                        <div style="font-size: 13px; color: #9ca3af;">Deadlines Met</div>
                    </div>
                    <div style="background-color: #13151a; border-radius: 8px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #f59e0b;">{upcoming_deadlines}</div>
                        <div style="font-size: 13px; color: #9ca3af;">Upcoming Deadlines</div>
                    </div>
                    <div style="background-color: #13151a; border-radius: 8px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #a855f7;">{xp_earned}</div>
                        <div style="font-size: 13px; color: #9ca3af;">XP Earned</div>
                    </div>
                </div>
            </div>
            <div style="padding: 16px 24px 24px 24px;">
                <a href="{FRONTEND_URL}/app" style="display: inline-block; background: linear-gradient(to right, #06b6d4, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">
                    View Dashboard
                </a>
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.1); background-color: #13151a;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                    You received this email because weekly digest is enabled in your {APP_NAME} settings.
                    <a href="{FRONTEND_URL}/app/settings" style="color: #60a5fa;">Manage preferences</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    subject = f"Your {APP_NAME} Weekly Summary"
    success = _send_email(email, subject, html_content)
    if success:
        logger.info(f"Weekly digest sent to {email}")
    else:
        logger.error(f"Failed to send weekly digest to {email}")
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
