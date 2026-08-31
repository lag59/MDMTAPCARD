import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def _send_sync(to_email: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL or settings.ADMIN_NOTIFICATION_EMAIL
    message["To"] = to_email
    message.set_content(body)

    if settings.SMTP_USE_SSL:
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
    with server:
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            server.starttls()
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)


async def send_email(to_email: str, subject: str, body: str) -> bool:
    """Best-effort email send. Returns False (and logs) instead of raising
    so a notification failure never breaks the calling request."""
    if not settings.SMTP_HOST:
        logger.warning("SMTP_HOST not configured; skipping email to %s: %s", to_email, subject)
        return False
    try:
        await asyncio.to_thread(_send_sync, to_email, subject, body)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False
