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
from datetime import datetime

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


def _base_html_template(content: str, preview_text: str = "") -> str:
    """
    Base HTML email template with Made4Founders branding.
    Includes logo header, legal disclaimer, and Axion Deep Labs footer.
    """
    current_year = datetime.now().year
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{APP_NAME}</title>
    <!--[if mso]>
    <style type="text/css">
        body, table, td {{font-family: Arial, sans-serif !important;}}
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <!-- Preview text -->
    <div style="display: none; max-height: 0; overflow: hidden;">
        {preview_text}
    </div>

    <!-- Email container -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f1117;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <!-- Content card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #1a1d24; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
                    <!-- Header with Logo -->
                    <tr>
                        <td style="padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <img src="https://made4founders.com/made4founders-logo-horizontal.png" alt="Made4Founders" width="200" style="display: block; margin: 0 auto; max-width: 200px; height: auto;">
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 32px 40px;">
                            {content}
                        </td>
                    </tr>

                    <!-- Legal Disclaimer -->
                    <tr>
                        <td style="padding: 24px 40px; border-top: 1px solid rgba(255,255,255,0.1); background-color: #13151a;">
                            <p style="margin: 0 0 16px; font-size: 12px; color: #6b7280; line-height: 1.6; text-align: center;">
                                This email was sent by {APP_NAME}. You received this because you have an account with us
                                or requested this notification.
                            </p>
                            <p style="margin: 0 0 16px; font-size: 12px; color: #6b7280; text-align: center;">
                                <a href="{FRONTEND_URL}/app/settings" style="color: #06b6d4; text-decoration: none;">Email Preferences</a>
                                &nbsp;&bull;&nbsp;
                                <a href="{FRONTEND_URL}/privacy" style="color: #06b6d4; text-decoration: none;">Privacy Policy</a>
                                &nbsp;&bull;&nbsp;
                                <a href="{FRONTEND_URL}/terms" style="color: #06b6d4; text-decoration: none;">Terms of Service</a>
                            </p>
                        </td>
                    </tr>

                    <!-- Axion Deep Labs Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background-color: #0a0b0d; border-top: 1px solid rgba(255,255,255,0.05);">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="text-align: center;">
                                        <p style="margin: 0 0 8px; font-size: 11px; color: #4b5563; text-transform: uppercase; letter-spacing: 1px;">
                                            A Product By
                                        </p>
                                        <img src="https://axiondeep.com/images/logo.webp" alt="Axion Deep Labs" width="120" style="display: inline-block; max-width: 120px; height: auto; opacity: 0.8;">
                                        <p style="margin: 12px 0 0; font-size: 11px; color: #4b5563;">
                                            &copy; {current_year} Axion Deep Labs Inc. All rights reserved.
                                        </p>
                                        <p style="margin: 8px 0 0; font-size: 10px; color: #374151;">
                                            Delaware, USA &bull; <a href="mailto:labs@axiondeep.com" style="color: #6b7280; text-decoration: none;">labs@axiondeep.com</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def _button_html(text: str, url: str, color: str = "#06b6d4") -> str:
    """Generate an HTML button for emails."""
    return f"""
<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
    <tr>
        <td style="border-radius: 8px; background: linear-gradient(to right, #06b6d4, #8b5cf6);">
            <a href="{url}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                {text}
            </a>
        </td>
    </tr>
</table>
"""


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

    content = f"""
<h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #f3f4f6;">
    Welcome to {APP_NAME}!
</h1>
<p style="margin: 0 0 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
    {greeting.replace(',', '')} Thanks for signing up!
</p>
<p style="margin: 0 0 8px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
    Please verify your email address to complete your registration and start managing your business.
</p>
{_button_html("Verify Email Address", verification_url)}
<p style="margin: 0 0 8px; font-size: 14px; color: #6b7280; line-height: 1.6;">
    Or copy and paste this link into your browser:
</p>
<p style="margin: 0 0 16px; font-size: 13px; color: #6b7280; word-break: break-all; background-color: #13151a; padding: 12px; border-radius: 8px;">
    {verification_url}
</p>
<p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
    This link expires in <strong style="color: #f59e0b;">24 hours</strong>.
</p>
<p style="margin: 16px 0 0; font-size: 13px; color: #4b5563; line-height: 1.6;">
    If you didn't create an account with {APP_NAME}, please ignore this email.
</p>
"""

    html_content = _base_html_template(content, "Verify your email to complete registration")
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

    content = f"""
<h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #f3f4f6;">
    Password Reset Request
</h1>
<p style="margin: 0 0 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
    {greeting.replace(',', '')} We received a request to reset your password.
</p>
<p style="margin: 0 0 8px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
    Click the button below to create a new password:
</p>
{_button_html("Reset Password", reset_url)}
<p style="margin: 0 0 8px; font-size: 14px; color: #6b7280; line-height: 1.6;">
    Or copy and paste this link into your browser:
</p>
<p style="margin: 0 0 16px; font-size: 13px; color: #6b7280; word-break: break-all; background-color: #13151a; padding: 12px; border-radius: 8px;">
    {reset_url}
</p>
<div style="margin: 16px 0; padding: 12px 16px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;">
    <p style="margin: 0; font-size: 14px; color: #f87171;">
        <strong>This link expires in 1 hour.</strong>
    </p>
</div>
<p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.6;">
    If you didn't request a password reset, please ignore this email or contact support if you have concerns. Your password will remain unchanged.
</p>
"""

    html_content = _base_html_template(content, "Reset your password")
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
        intro = "You have deadlines due <strong style='color: #ef4444;'>today</strong>:"
        urgency_color = "#ef4444"  # red
    elif reminder_type == "tomorrow":
        subject = f"{len(deadlines)} deadline(s) due tomorrow - {APP_NAME}"
        intro = "You have deadlines due <strong style='color: #f59e0b;'>tomorrow</strong>:"
        urgency_color = "#f59e0b"  # amber
    else:  # week
        subject = f"{len(deadlines)} deadline(s) coming up this week - {APP_NAME}"
        intro = "You have deadlines due <strong style='color: #3b82f6;'>this week</strong>:"
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

    content = f"""
<h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: {urgency_color};">
    Deadline Reminder
</h1>
<p style="margin: 0 0 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
    {greeting.replace(',', '')} {intro}
</p>
<table style="width: 100%; border-collapse: collapse; background-color: #13151a; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
    {deadline_items}
</table>
{_button_html("View All Deadlines", f"{FRONTEND_URL}/app/deadlines")}
"""

    html_content = _base_html_template(content, f"{len(deadlines)} deadline(s) need your attention")
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

    content = f"""
<h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #22d3ee;">
    Your Weekly Summary
</h1>
<p style="margin: 0 0 24px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
    {greeting.replace(',', '')} Here's how your week went.
</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
    <tr>
        <td width="48%" style="padding: 16px; background-color: #13151a; border-radius: 8px; text-align: center; vertical-align: top;">
            <div style="font-size: 32px; font-weight: bold; color: #22d3ee;">{tasks_completed}</div>
            <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">Tasks Completed</div>
        </td>
        <td width="4%"></td>
        <td width="48%" style="padding: 16px; background-color: #13151a; border-radius: 8px; text-align: center; vertical-align: top;">
            <div style="font-size: 32px; font-weight: bold; color: #10b981;">{deadlines_met}</div>
            <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">Deadlines Met</div>
        </td>
    </tr>
    <tr><td colspan="3" height="12"></td></tr>
    <tr>
        <td width="48%" style="padding: 16px; background-color: #13151a; border-radius: 8px; text-align: center; vertical-align: top;">
            <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">{upcoming_deadlines}</div>
            <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">Upcoming Deadlines</div>
        </td>
        <td width="4%"></td>
        <td width="48%" style="padding: 16px; background-color: #13151a; border-radius: 8px; text-align: center; vertical-align: top;">
            <div style="font-size: 32px; font-weight: bold; color: #a855f7;">{xp_earned}</div>
            <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">XP Earned</div>
        </td>
    </tr>
</table>

{_button_html("View Dashboard", f"{FRONTEND_URL}/app")}
"""

    html_content = _base_html_template(content, f"Your weekly summary: {tasks_completed} tasks completed")
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
    login_time = datetime.now().strftime("%B %d, %Y at %H:%M UTC")

    content = f"""
<h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #f59e0b;">
    New Login Detected
</h1>
<p style="margin: 0 0 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
    {greeting.replace(',', '')} We noticed a new login to your {APP_NAME} account.
</p>

<div style="margin: 24px 0; padding: 20px; background-color: #13151a; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
    <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; font-size: 15px;">
        <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 100px;">Device:</td>
            <td style="padding: 8px 0; color: #f3f4f6; font-weight: 500;">{device_str}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #6b7280;">IP Address:</td>
            <td style="padding: 8px 0; color: #f3f4f6; font-weight: 500; font-family: monospace;">{ip_str}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; color: #6b7280;">Time:</td>
            <td style="padding: 8px 0; color: #f3f4f6; font-weight: 500;">{login_time}</td>
        </tr>
    </table>
</div>

<p style="margin: 0 0 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
    If this was you, you can safely ignore this email.
</p>

<div style="margin: 16px 0; padding: 16px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;">
    <p style="margin: 0; font-size: 14px; color: #f87171; line-height: 1.6;">
        <strong>Wasn't you?</strong> Secure your account immediately by changing your password and enabling two-factor authentication.
    </p>
</div>

{_button_html("Review Account Security", f"{FRONTEND_URL}/app/settings")}
"""

    html_content = _base_html_template(content, "New login to your account detected")
    subject = f"New login to your {APP_NAME} account"
    success = _send_email(email, subject, html_content)
    if success:
        logger.info(f"Login alert email sent to {email}")
    else:
        logger.error(f"Failed to send login alert email to {email}")
    return success
