"""
System monitoring and health checks.

Provides:
- Comprehensive health checks for all services
- System metrics (CPU, memory, disk)
- Alerting webhooks (Slack, email)
- Status page data

Endpoints:
- GET /api/monitoring/health - Quick health check
- GET /api/monitoring/status - Detailed status with metrics
- POST /api/monitoring/test-alert - Send test alert (admin only)
"""
import os
import logging
import time
import platform
from datetime import datetime, UTC, UTC
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from .database import get_db
from .auth import get_current_user
from .models import User

logger = logging.getLogger(__name__)

router = APIRouter()

# Configuration
ALERT_WEBHOOK_URL = os.getenv("ALERT_WEBHOOK_URL", "")  # Slack webhook or similar
ALERT_EMAIL = os.getenv("ALERT_EMAIL", "")
UPTIME_START = datetime.now(UTC)


class HealthStatus(BaseModel):
    """Health check response."""
    status: str  # healthy, degraded, unhealthy
    timestamp: datetime
    uptime_seconds: int
    version: str
    checks: Dict[str, Any]


class SystemMetrics(BaseModel):
    """System resource metrics."""
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    disk_percent: Optional[float] = None
    disk_free_gb: Optional[float] = None
    python_version: str
    platform: str


def check_database(db: Session) -> Dict[str, Any]:
    """Check database connectivity."""
    try:
        start = time.time()
        db.execute(text("SELECT 1"))
        latency_ms = (time.time() - start) * 1000
        return {
            "status": "healthy",
            "latency_ms": round(latency_ms, 2)
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


def check_disk() -> Dict[str, Any]:
    """Check disk space."""
    try:
        import shutil
        total, used, free = shutil.disk_usage("/")
        free_gb = free / (1024**3)
        used_percent = (used / total) * 100

        status = "healthy"
        if used_percent > 90:
            status = "unhealthy"
        elif used_percent > 80:
            status = "degraded"

        return {
            "status": status,
            "used_percent": round(used_percent, 1),
            "free_gb": round(free_gb, 2)
        }
    except Exception as e:
        logger.error(f"Disk health check failed: {e}")
        return {
            "status": "unknown",
            "error": str(e)
        }


def check_s3() -> Dict[str, Any]:
    """Check S3 connectivity for backups."""
    bucket = os.getenv("BACKUP_S3_BUCKET", "")
    if not bucket:
        return {
            "status": "not_configured",
            "message": "BACKUP_S3_BUCKET not set"
        }

    try:
        import boto3
        s3 = boto3.client('s3', region_name=os.getenv("AWS_REGION", "us-east-1"))
        start = time.time()
        s3.head_bucket(Bucket=bucket)
        latency_ms = (time.time() - start) * 1000
        return {
            "status": "healthy",
            "latency_ms": round(latency_ms, 2)
        }
    except ImportError:
        return {
            "status": "not_configured",
            "message": "boto3 not installed"
        }
    except Exception as e:
        logger.error(f"S3 health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


def check_email() -> Dict[str, Any]:
    """Check email service configuration."""
    ses_region = os.getenv("AWS_REGION", "")
    email_from = os.getenv("EMAIL_FROM", "")

    if not ses_region or not email_from:
        return {
            "status": "not_configured",
            "message": "Email not configured"
        }

    # We don't actually send an email here, just verify config
    return {
        "status": "configured",
        "from_address": email_from,
        "region": ses_region
    }


def get_system_metrics() -> SystemMetrics:
    """Get system resource metrics."""
    cpu_percent = None
    memory_percent = None

    try:
        import psutil
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
    except ImportError:
        pass  # psutil not installed

    disk_info = check_disk()

    return SystemMetrics(
        cpu_percent=cpu_percent,
        memory_percent=memory_percent,
        disk_percent=disk_info.get("used_percent"),
        disk_free_gb=disk_info.get("free_gb"),
        python_version=platform.python_version(),
        platform=platform.platform()
    )


async def send_alert(title: str, message: str, severity: str = "warning"):
    """
    Send alert via configured channels (Slack webhook, email).
    """
    # Slack webhook
    if ALERT_WEBHOOK_URL:
        try:
            import httpx
            color = {
                "info": "#36a64f",
                "warning": "#ffa500",
                "error": "#ff0000"
            }.get(severity, "#808080")

            payload = {
                "attachments": [{
                    "color": color,
                    "title": title,
                    "text": message,
                    "footer": "Made4Founders Monitoring",
                    "ts": int(datetime.now(UTC).timestamp())
                }]
            }

            async with httpx.AsyncClient() as client:
                await client.post(ALERT_WEBHOOK_URL, json=payload)
                logger.info(f"Alert sent to Slack: {title}")
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")

    # Email alert
    if ALERT_EMAIL:
        try:
            from .email_service import send_email
            await send_email(
                to_email=ALERT_EMAIL,
                subject=f"[{severity.upper()}] {title}",
                html_content=f"""
                <h2>{title}</h2>
                <p>{message}</p>
                <hr>
                <p><small>Sent by Made4Founders Monitoring at {datetime.now(UTC).isoformat()}</small></p>
                """
            )
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")


def require_admin(current_user: User = Depends(get_current_user)):
    """Require admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/health")
async def quick_health(db: Session = Depends(get_db)):
    """
    Quick health check for load balancers and uptime monitors.
    Returns 200 if core services are working.
    """
    db_check = check_database(db)

    if db_check["status"] == "unhealthy":
        raise HTTPException(status_code=503, detail="Database unhealthy")

    return {
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat()
    }


@router.get("/status", response_model=HealthStatus)
async def detailed_status(db: Session = Depends(get_db)):
    """
    Detailed health status with all service checks.
    Used for status pages and monitoring dashboards.
    """
    checks = {
        "database": check_database(db),
        "disk": check_disk(),
        "s3": check_s3(),
        "email": check_email(),
    }

    # Determine overall status
    statuses = [c.get("status", "unknown") for c in checks.values()]
    if "unhealthy" in statuses:
        overall = "unhealthy"
    elif "degraded" in statuses:
        overall = "degraded"
    else:
        overall = "healthy"

    uptime = int((datetime.now(UTC) - UPTIME_START).total_seconds())

    return HealthStatus(
        status=overall,
        timestamp=datetime.now(UTC),
        uptime_seconds=uptime,
        version=os.getenv("APP_VERSION", "1.0.0"),
        checks=checks
    )


@router.get("/metrics")
async def system_metrics(current_user: User = Depends(require_admin)):
    """
    System resource metrics (admin only).
    """
    metrics = get_system_metrics()
    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "metrics": metrics.dict()
    }


@router.post("/test-alert")
async def test_alert(
    current_user: User = Depends(require_admin),
):
    """
    Send a test alert to verify alerting configuration.
    """
    if not ALERT_WEBHOOK_URL and not ALERT_EMAIL:
        raise HTTPException(
            status_code=400,
            detail="No alerting channels configured (ALERT_WEBHOOK_URL or ALERT_EMAIL)"
        )

    await send_alert(
        title="Test Alert",
        message="This is a test alert from Made4Founders monitoring system.",
        severity="info"
    )

    return {
        "success": True,
        "message": "Test alert sent",
        "channels": {
            "slack": bool(ALERT_WEBHOOK_URL),
            "email": bool(ALERT_EMAIL)
        }
    }


# Background health checker for automated alerts
async def run_health_checks_and_alert():
    """
    Run health checks and send alerts if issues detected.
    Call this from a scheduled task.
    """
    from .database import SessionLocal
    db = SessionLocal()

    try:
        checks = {
            "database": check_database(db),
            "disk": check_disk(),
            "s3": check_s3(),
        }

        issues = []
        for name, result in checks.items():
            status = result.get("status", "unknown")
            if status == "unhealthy":
                issues.append(f"- {name}: UNHEALTHY - {result.get('error', 'Unknown error')}")
            elif status == "degraded":
                issues.append(f"- {name}: DEGRADED - {result}")

        if issues:
            await send_alert(
                title="Health Check Alert",
                message="The following issues were detected:\n\n" + "\n".join(issues),
                severity="error" if any("UNHEALTHY" in i for i in issues) else "warning"
            )
    finally:
        db.close()
