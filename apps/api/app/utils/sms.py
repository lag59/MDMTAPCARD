import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def normalize_phone(phone: str) -> str:
    """Return an E.164-ish phone string (leading + preserved, digits only)."""
    trimmed = (phone or "").strip()
    has_plus = trimmed.startswith("+")
    digits = "".join(ch for ch in trimmed if ch.isdigit())
    if not digits:
        return ""
    return f"+{digits}" if has_plus else digits


def _twilio_credentials() -> tuple[str, str, str]:
    sid = settings.TWILIO_ACCOUNT_SID or settings.OTP_TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN or settings.OTP_TWILIO_AUTH_TOKEN
    from_number = settings.TWILIO_FROM_NUMBER or settings.OTP_TWILIO_FROM_NUMBER
    return sid, token, from_number


def sms_configured() -> bool:
    provider = (settings.SMS_PROVIDER or "").strip().lower()
    if provider == "mock":
        return True
    sid, token, from_number = _twilio_credentials()
    return bool(sid and token and from_number)


async def send_sms(to_phone: str, body: str) -> bool:
    """Best-effort SMS send. Returns False (and logs) instead of raising so a
    delivery failure never breaks the calling request."""
    to = normalize_phone(to_phone)
    if not to:
        logger.warning("send_sms called without a valid phone number")
        return False

    provider = (settings.SMS_PROVIDER or "").strip().lower()
    if provider == "mock":
        logger.info("SMS (mock) to %s: %s", to, body)
        return True

    sid, token, from_number = _twilio_credentials()
    if not (sid and token and from_number):
        logger.warning("Twilio SMS not configured; skipping SMS to %s", to)
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    data = {"From": from_number, "To": to, "Body": body}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, data=data, auth=(sid, token))
        if response.status_code >= 400:
            logger.error("Twilio SMS failed (%s): %s", response.status_code, response.text)
            return False
        return True
    except Exception:
        logger.exception("Failed to send SMS to %s", to)
        return False
