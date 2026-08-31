import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db
from app.models.signup_request import SignupRequest
from app.utils.email import send_email

router = APIRouter()

SELF_SERVICE_OPTIONS = {
    "digital_card",
    "physical_tap_card",
    "physical_tap_card_with_design",
    "tap_button_for_phone",
}

SERVICE_PRICE_CENTS = {
    "digital_card": 399,
    "physical_tap_card": 9900,
    "physical_tap_card_with_design": 14900,
    "tap_button_for_phone": 7900,
}


def _square_base_url() -> str:
    if settings.SQUARE_API_BASE_URL:
        return settings.SQUARE_API_BASE_URL.rstrip("/")
    env = (settings.SQUARE_ENVIRONMENT or "sandbox").strip().lower()
    if env == "production":
        return "https://connect.squareup.com"
    return "https://connect.squareupsandbox.com"


async def _create_square_checkout_link(*, amount_cents: int, currency: str, title: str) -> tuple[str, str]:
    if not settings.SQUARE_ACCESS_TOKEN or not settings.SQUARE_LOCATION_ID:
        raise HTTPException(
            status_code=400,
            detail="Square is not configured. Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.",
        )

    payload: dict[str, object] = {
        "idempotency_key": str(uuid.uuid4()),
        "quick_pay": {
            "name": title,
            "price_money": {
                "amount": amount_cents,
                "currency": currency,
            },
            "location_id": settings.SQUARE_LOCATION_ID,
        },
    }

    if settings.SQUARE_CHECKOUT_REDIRECT_URL:
        payload["checkout_options"] = {
            "redirect_url": settings.SQUARE_CHECKOUT_REDIRECT_URL,
        }

    url = f"{_square_base_url()}/v2/online-checkout/payment-links"
    headers = {
        "Authorization": f"Bearer {settings.SQUARE_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "Square-Version": "2026-08-01",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = "Square checkout request failed"
        try:
            body = exc.response.json()
            errors = body.get("errors") if isinstance(body, dict) else None
            if errors and isinstance(errors, list):
                first = errors[0]
                if isinstance(first, dict) and first.get("detail"):
                    detail = str(first["detail"])
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Could not reach Square API") from exc

    data = response.json()
    payment_link = data.get("payment_link") if isinstance(data, dict) else None
    if not isinstance(payment_link, dict) or not payment_link.get("url") or not payment_link.get("id"):
        raise HTTPException(status_code=502, detail="Invalid Square API response")

    return str(payment_link["url"]), str(payment_link["id"])


class SignupRequestIn(BaseModel):
    company_name: str
    contact_name: str
    email: EmailStr
    phone: str | None = None
    plan_interest: str | None = None
    service_interest: str
    team_size: str | None = None
    quantity: int | None = None
    shipping_name: str | None = None
    shipping_company: str | None = None
    shipping_address1: str | None = None
    shipping_address2: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_postal_code: str | None = None
    shipping_country: str | None = None
    notes: str | None = None


class SignupRequestOut(BaseModel):
    request_id: uuid.UUID
    submitted: bool
    message: str
    payment_required: bool = False
    checkout_url: str | None = None
    is_design_request: bool = False


@router.post("/signup-request", response_model=SignupRequestOut)
async def submit_signup_request(
    body: SignupRequestIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    company_name = body.company_name.strip()
    contact_name = body.contact_name.strip()
    phone = (body.phone or "").strip() or None
    plan_interest = (body.plan_interest or "").strip() or None
    service_interest = body.service_interest.strip()
    team_size = (body.team_size or "").strip() or None
    quantity = body.quantity
    shipping_name = (body.shipping_name or "").strip() or None
    shipping_company = (body.shipping_company or "").strip() or None
    shipping_address1 = (body.shipping_address1 or "").strip() or None
    shipping_address2 = (body.shipping_address2 or "").strip() or None
    shipping_city = (body.shipping_city or "").strip() or None
    shipping_state = (body.shipping_state or "").strip() or None
    shipping_postal_code = (body.shipping_postal_code or "").strip() or None
    shipping_country = (body.shipping_country or "").strip().upper() or None
    notes = (body.notes or "").strip() or None
    email = body.email.lower().strip()

    if len(company_name) < 2:
        raise HTTPException(status_code=400, detail="Company name is required")
    if len(contact_name) < 2:
        raise HTTPException(status_code=400, detail="Contact name is required")
    if service_interest not in SELF_SERVICE_OPTIONS:
        raise HTTPException(status_code=400, detail="Invalid service_interest")

    requires_shipping = service_interest in {
        "physical_tap_card",
        "physical_tap_card_with_design",
        "tap_button_for_phone",
    }

    if requires_shipping:
        missing_shipping = [
            key
            for key, value in {
                "shipping_name": shipping_name,
                "shipping_address1": shipping_address1,
                "shipping_city": shipping_city,
                "shipping_state": shipping_state,
                "shipping_postal_code": shipping_postal_code,
                "shipping_country": shipping_country,
            }.items()
            if not value
        ]
        if missing_shipping:
            raise HTTPException(status_code=400, detail=f"Missing shipping fields: {', '.join(missing_shipping)}")

    if quantity is not None and quantity < 1:
        raise HTTPException(status_code=400, detail="quantity must be at least 1")

    normalized_quantity = quantity if quantity is not None else 1
    if service_interest == "digital_card":
        normalized_quantity = 1

    # Custom-layout orders need a human to scope the design and quote a final
    # price, so they skip checkout and go to the admin for manual follow-up.
    is_design_request = service_interest == "physical_tap_card_with_design"

    unit_amount_cents = SERVICE_PRICE_CENTS[service_interest]
    amount_cents = None if is_design_request else unit_amount_cents * normalized_quantity
    payment_required = bool(amount_cents) and amount_cents > 0

    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    recent_existing = (
        await db.execute(
            select(SignupRequest)
            .where(SignupRequest.email == email, SignupRequest.created_at >= cooldown_cutoff)
            .order_by(SignupRequest.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if recent_existing:
        raise HTTPException(status_code=429, detail="A request was already submitted recently. Please wait a few minutes.")

    square_checkout_url: str | None = None
    square_payment_link_id: str | None = None
    if payment_required:
        title = f"MDM TapCard signup • {service_interest} x{normalized_quantity}"
        square_checkout_url, square_payment_link_id = await _create_square_checkout_link(
            amount_cents=amount_cents,
            currency="USD",
            title=title,
        )

    request = SignupRequest(
        company_name=company_name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        plan_interest=plan_interest,
        service_interest=service_interest,
        team_size=team_size,
        quantity=normalized_quantity,
        shipping_name=shipping_name,
        shipping_company=shipping_company,
        shipping_address1=shipping_address1,
        shipping_address2=shipping_address2,
        shipping_city=shipping_city,
        shipping_state=shipping_state,
        shipping_postal_code=shipping_postal_code,
        shipping_country=shipping_country,
        amount_cents=amount_cents,
        currency="USD",
        payment_required=payment_required,
        square_checkout_url=square_checkout_url,
        square_payment_link_id=square_payment_link_id,
        notes=notes,
        status="design_request" if is_design_request else "new",
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    if is_design_request:
        shipping_lines = ", ".join(
            filter(None, [shipping_address1, shipping_city, shipping_state, shipping_postal_code, shipping_country])
        )
        await send_email(
            settings.ADMIN_NOTIFICATION_EMAIL,
            f"New custom design request \u2014 {company_name}",
            (
                f"Company: {company_name}\n"
                f"Contact: {contact_name}\n"
                f"Email: {email}\n"
                f"Phone: {phone or '-'}\n"
                f"Quantity: {normalized_quantity}\n"
                f"Shipping: {shipping_lines or '-'}\n"
                f"Notes: {notes or '-'}\n\n"
                f"Request ID: {request.id}\n"
                "Complete this request in the admin Signup Requests queue to quote a price and generate checkout."
            ),
        )

    message = (
        "Thanks! Your custom design request was received. We'll follow up to finalize your design and pricing."
        if is_design_request
        else "Thanks! Your signup request was received."
    )

    return SignupRequestOut(
        request_id=request.id,
        submitted=True,
        message=message,
        payment_required=payment_required,
        checkout_url=square_checkout_url,
        is_design_request=is_design_request,
    )
