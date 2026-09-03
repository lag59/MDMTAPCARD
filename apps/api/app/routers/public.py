import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
import httpx
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db
from app.models.signup_request import SignupRequest
from app.utils.email import send_email

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# One-time profile setup fee applied to every self-service signup.
PROFILE_SETUP_CENTS = 4900

# Digital service ("Essential") pricing. Monthly is billed separately; only the
# annual prepay is collected in the one-time signup checkout.
MONTHLY_SERVICE_CENTS = 399
ANNUAL_SERVICE_CENTS = 3900

# One-time NFC product prices in cents. ``None`` means the product is custom and
# must be quoted by hand instead of going through instant checkout.
PRODUCT_PRICE_CENTS: dict[str, int | None] = {
    "digital_only": 0,
    "tap_button": 999,
    "pvc_tapcard": 1499,
    "keychain": 1499,
    "wood_tapcard": 3499,
    "ring": 3999,
    "metal_tapcard": 4999,
    "premium_custom_metal": None,
    "custom_design": None,
}

SELF_SERVICE_OPTIONS = set(PRODUCT_PRICE_CENTS.keys())

# Products that ship a physical item and therefore need a shipping address.
PHYSICAL_PRODUCTS = {
    "tap_button",
    "pvc_tapcard",
    "keychain",
    "wood_tapcard",
    "ring",
    "metal_tapcard",
    "premium_custom_metal",
    "custom_design",
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


def _annual_subscription_start() -> str:
    # Year 1 of an annual plan is prepaid at checkout, so the recurring
    # subscription begins one year out to avoid double-charging.
    return (datetime.now(timezone.utc).date() + timedelta(days=365)).isoformat()


async def _square_request(method: str, path: str, payload: dict | None = None) -> dict:
    if not settings.SQUARE_ACCESS_TOKEN or not settings.SQUARE_LOCATION_ID:
        raise HTTPException(status_code=400, detail="Square is not configured.")
    url = f"{_square_base_url()}{path}"
    headers = {
        "Authorization": f"Bearer {settings.SQUARE_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "Square-Version": "2026-08-01",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.request(method, url, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()


async def _ensure_square_customer(email: str, contact_name: str) -> str:
    search = await _square_request(
        "POST",
        "/v2/customers/search",
        {"query": {"filter": {"email_address": {"exact": email}}}, "limit": 1},
    )
    existing = search.get("customers") or []
    if existing:
        return str(existing[0]["id"])
    given, _, family = contact_name.partition(" ")
    created = await _square_request(
        "POST",
        "/v2/customers",
        {
            "idempotency_key": str(uuid.uuid4()),
            "email_address": email,
            "given_name": given or contact_name,
            "family_name": family or None,
        },
    )
    return str(created["customer"]["id"])


async def _ensure_subscription_plan_variation(name: str, amount_cents: int, cadence: str) -> str:
    try:
        search = await _square_request(
            "POST",
            "/v2/catalog/search-catalog-objects",
            {
                "object_types": ["SUBSCRIPTION_PLAN_VARIATION"],
                "query": {"exact_query": {"attribute_name": "name", "attribute_value": name}},
                "limit": 1,
            },
        )
        found = search.get("objects") or []
        if found:
            return str(found[0]["id"])
    except Exception:
        pass  # Fall through and create the plan.

    created = await _square_request(
        "POST",
        "/v2/catalog/object",
        {
            "idempotency_key": str(uuid.uuid4()),
            "object": {
                "type": "SUBSCRIPTION_PLAN",
                "id": "#plan",
                "subscription_plan_data": {
                    "name": name,
                    "subscription_plan_variations": [
                        {
                            "type": "SUBSCRIPTION_PLAN_VARIATION",
                            "id": "#variation",
                            "subscription_plan_variation_data": {
                                "name": name,
                                "phases": [
                                    {
                                        "cadence": cadence,
                                        "pricing": {
                                            "type": "STATIC",
                                            "price_money": {"amount": amount_cents, "currency": "USD"},
                                        },
                                    }
                                ],
                            },
                        }
                    ],
                },
            },
        },
    )
    for mapping in created.get("id_mappings") or []:
        if mapping.get("client_object_id") == "#variation":
            return str(mapping["object_id"])
    variations = (
        (created.get("catalog_object") or {})
        .get("subscription_plan_data", {})
        .get("subscription_plan_variations")
        or []
    )
    if variations:
        return str(variations[0]["id"])
    raise HTTPException(status_code=502, detail="Could not create Square subscription plan")


async def _create_card_on_file(customer_id: str, source_id: str) -> str:
    created = await _square_request(
        "POST",
        "/v2/cards",
        {
            "idempotency_key": str(uuid.uuid4()),
            "source_id": source_id,
            "card": {"customer_id": customer_id},
        },
    )
    return str(created["card"]["id"])


async def _start_recurring_subscription(
    *,
    email: str,
    contact_name: str,
    plan_name: str,
    amount_cents: int,
    cadence: str,
    start_date: str | None,
    card_source_id: str | None = None,
) -> tuple[str, str, str]:
    """Create a recurring Square subscription so the plan auto-renews.

    When a tokenized ``card_source_id`` is supplied the card is saved on file and
    Square auto-charges it each cycle; otherwise Square emails a recurring invoice.
    """
    customer_id = await _ensure_square_customer(email, contact_name)
    variation_id = await _ensure_subscription_plan_variation(plan_name, amount_cents, cadence)
    payload: dict[str, object] = {
        "idempotency_key": str(uuid.uuid4()),
        "location_id": settings.SQUARE_LOCATION_ID,
        "customer_id": customer_id,
        "plan_variation_id": variation_id,
    }
    if card_source_id:
        payload["card_id"] = await _create_card_on_file(customer_id, card_source_id)
    if start_date:
        payload["start_date"] = start_date
    created = await _square_request("POST", "/v2/subscriptions", payload)
    subscription = created.get("subscription") or {}
    return customer_id, str(subscription.get("id") or ""), str(subscription.get("status") or "unknown")

@router.get("/payments-config")
async def payments_config():
    env = (settings.SQUARE_ENVIRONMENT or "sandbox").strip().lower()
    return {
        "application_id": settings.SQUARE_APPLICATION_ID or None,
        "location_id": settings.SQUARE_LOCATION_ID or None,
        "environment": "production" if env == "production" else "sandbox",
        "subscriptions_enabled": settings.SQUARE_SUBSCRIPTIONS_ENABLED,
    }


def _verify_square_signature(signature: str | None, raw_body: bytes) -> bool:
    key = settings.SQUARE_WEBHOOK_SIGNATURE_KEY
    if not key or not signature:
        return False
    notification_url = (
        settings.SQUARE_WEBHOOK_NOTIFICATION_URL
        or f"{settings.API_PUBLIC_URL.rstrip('/')}/api/v1/public/square-webhook"
    )
    mac = hmac.new(key.encode("utf-8"), (notification_url + raw_body.decode("utf-8")).encode("utf-8"), hashlib.sha256)
    expected = base64.b64encode(mac.digest()).decode("utf-8")
    return hmac.compare_digest(expected, signature)


def _webhook_status_update(payload: dict) -> tuple[str | None, str | None]:
    """Map a Square webhook event to (subscription_id, new_status), if relevant."""
    event_type = payload.get("type")
    data = (payload.get("data") or {}).get("object") or {}
    if event_type == "subscription.updated":
        sub = data.get("subscription") or {}
        return sub.get("id"), sub.get("status")
    if event_type == "invoice.payment_made":
        invoice = data.get("invoice") or {}
        return invoice.get("subscription_id"), "ACTIVE"
    if event_type in {"invoice.canceled", "invoice.failed"}:
        invoice = data.get("invoice") or {}
        return invoice.get("subscription_id"), "PAYMENT_FAILED" if event_type == "invoice.failed" else "CANCELED"
    return None, None


@router.post("/square-webhook")
async def square_webhook(request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    raw_body = await request.body()
    # When no signature key is configured, acknowledge without processing so
    # Square's connectivity test succeeds and unverified events are ignored.
    if not settings.SQUARE_WEBHOOK_SIGNATURE_KEY:
        return {"status": "webhook not configured"}
    signature = request.headers.get("x-square-hmacsha256-signature")
    if not _verify_square_signature(signature, raw_body):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        return {"status": "ignored"}

    subscription_id, new_status = _webhook_status_update(payload)
    if subscription_id and new_status:
        row = (
            await db.execute(
                select(SignupRequest)
                .where(SignupRequest.square_subscription_id == subscription_id)
                .limit(1)
            )
        ).scalar_one_or_none()
        if row:
            row.subscription_status = str(new_status)
            await db.commit()
    return {"status": "ok"}


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
    card_source_id: str | None = None


class SignupRequestOut(BaseModel):
    request_id: uuid.UUID
    submitted: bool
    message: str
    payment_required: bool = False
    checkout_url: str | None = None
    is_design_request: bool = False


@router.post("/signup-request", response_model=SignupRequestOut)
@limiter.limit("5/minute")
async def submit_signup_request(
    request: Request,
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
    card_source_id = (body.card_source_id or "").strip() or None
    email = body.email.lower().strip()

    if len(company_name) < 2:
        raise HTTPException(status_code=400, detail="Company name is required")
    if len(contact_name) < 2:
        raise HTTPException(status_code=400, detail="Contact name is required")
    if service_interest not in SELF_SERVICE_OPTIONS:
        raise HTTPException(status_code=400, detail="Invalid service_interest")

    requires_shipping = service_interest in PHYSICAL_PRODUCTS

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
    if service_interest == "digital_only":
        normalized_quantity = 1

    product_price_cents = PRODUCT_PRICE_CENTS[service_interest]

    # Custom products are scoped and priced by a human, so they skip instant
    # checkout and go to the admin for manual follow-up.
    is_design_request = product_price_cents is None

    annual_plan = plan_interest == "essential_annual"
    if is_design_request:
        amount_cents = None
    else:
        # Due today = one-time setup + product(s) + annual prepay (if chosen).
        # The $3.99/month Essential plan is billed separately from this link.
        service_cents = ANNUAL_SERVICE_CENTS if annual_plan else 0
        amount_cents = PROFILE_SETUP_CENTS + product_price_cents * normalized_quantity + service_cents
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

    square_customer_id: str | None = None
    square_subscription_id: str | None = None
    subscription_status: str | None = None
    if settings.SQUARE_SUBSCRIPTIONS_ENABLED and not is_design_request:
        service_amount = ANNUAL_SERVICE_CENTS if annual_plan else MONTHLY_SERVICE_CENTS
        cadence = "ANNUAL" if annual_plan else "MONTHLY"
        plan_name = f"MDM Essential {cadence.title()} ${service_amount / 100:.2f}"
        start_date = _annual_subscription_start() if annual_plan else None
        try:
            square_customer_id, square_subscription_id, subscription_status = await _start_recurring_subscription(
                email=email,
                contact_name=contact_name,
                plan_name=plan_name,
                amount_cents=service_amount,
                cadence=cadence,
                start_date=start_date,
                card_source_id=card_source_id,
            )
        except Exception:
            subscription_status = "error"

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
        square_customer_id=square_customer_id,
        square_subscription_id=square_subscription_id,
        subscription_status=subscription_status,
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


# ── Enterprise pricing ───────────────────────────────────────────────────────

ENTERPRISE_SETUP_CENTS = 29900
ENTERPRISE_MIN_USERS = 10
ENTERPRISE_CUSTOM_THRESHOLD = 100  # 100+ users are quoted manually.

# Per-user digital service rates in cents, keyed by tier lower bound.
ENTERPRISE_MONTHLY_RATE_CENTS = {10: 299, 25: 279, 50: 249}
ENTERPRISE_ANNUAL_RATE_CENTS = {10: 2900, 25: 2700, 50: 2400}

# One-time enterprise NFC hardware prices in cents. ``None`` requires a quote.
ENTERPRISE_HARDWARE_CENTS: dict[str, int | None] = {
    "none": 0,
    "pvc_tapcard": 1299,
    "keychain": 1299,
    "tap_button": 799,
    "wood_tapcard": 2999,
    "ring": 3499,
    "metal_tapcard": 4499,
    "premium_custom_metal": None,
}

ENTERPRISE_PHYSICAL_HARDWARE = {
    "pvc_tapcard",
    "keychain",
    "tap_button",
    "wood_tapcard",
    "ring",
    "metal_tapcard",
    "premium_custom_metal",
}


def _enterprise_rate_cents(user_count: int, *, annual: bool) -> int | None:
    """Per-user service rate for a team size, or None for custom (100+) tiers."""
    if user_count >= ENTERPRISE_CUSTOM_THRESHOLD:
        return None
    table = ENTERPRISE_ANNUAL_RATE_CENTS if annual else ENTERPRISE_MONTHLY_RATE_CENTS
    rate: int | None = None
    for lower_bound in sorted(table):
        if user_count >= lower_bound:
            rate = table[lower_bound]
    return rate


class EnterpriseSignupIn(BaseModel):
    company_name: str
    contact_name: str
    email: EmailStr
    phone: str | None = None
    user_count: int
    billing: str = "monthly"  # "monthly" | "annual"
    hardware: str = "none"
    hardware_quantity: int | None = None
    shipping_name: str | None = None
    shipping_company: str | None = None
    shipping_address1: str | None = None
    shipping_address2: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_postal_code: str | None = None
    shipping_country: str | None = None
    notes: str | None = None
    card_source_id: str | None = None


@router.post("/enterprise-signup-request", response_model=SignupRequestOut)
@limiter.limit("5/minute")
async def submit_enterprise_signup_request(
    request: Request,
    body: EnterpriseSignupIn,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    company_name = body.company_name.strip()
    contact_name = body.contact_name.strip()
    phone = (body.phone or "").strip() or None
    email = body.email.lower().strip()
    billing = (body.billing or "monthly").strip().lower()
    hardware = (body.hardware or "none").strip().lower()
    notes = (body.notes or "").strip() or None
    card_source_id = (body.card_source_id or "").strip() or None

    shipping_name = (body.shipping_name or "").strip() or None
    shipping_company = (body.shipping_company or "").strip() or None
    shipping_address1 = (body.shipping_address1 or "").strip() or None
    shipping_address2 = (body.shipping_address2 or "").strip() or None
    shipping_city = (body.shipping_city or "").strip() or None
    shipping_state = (body.shipping_state or "").strip() or None
    shipping_postal_code = (body.shipping_postal_code or "").strip() or None
    shipping_country = (body.shipping_country or "").strip().upper() or None

    if len(company_name) < 2:
        raise HTTPException(status_code=400, detail="Company name is required")
    if len(contact_name) < 2:
        raise HTTPException(status_code=400, detail="Contact name is required")
    if billing not in {"monthly", "annual"}:
        raise HTTPException(status_code=400, detail="billing must be 'monthly' or 'annual'")
    if hardware not in ENTERPRISE_HARDWARE_CENTS:
        raise HTTPException(status_code=400, detail="Invalid hardware selection")

    user_count = body.user_count
    if user_count < ENTERPRISE_MIN_USERS:
        raise HTTPException(status_code=400, detail=f"Enterprise plans require at least {ENTERPRISE_MIN_USERS} users")

    annual_plan = billing == "annual"
    hardware_cents = ENTERPRISE_HARDWARE_CENTS[hardware]
    per_user_cents = _enterprise_rate_cents(user_count, annual=annual_plan)

    # Default to one card per user when hardware is selected.
    if hardware == "none":
        hardware_quantity = 0
    else:
        hardware_quantity = body.hardware_quantity if body.hardware_quantity is not None else user_count
        if hardware_quantity < 1:
            raise HTTPException(status_code=400, detail="hardware_quantity must be at least 1")

    requires_shipping = hardware in ENTERPRISE_PHYSICAL_HARDWARE
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

    # 100+ user tiers and custom hardware are scoped and quoted by hand.
    is_quote = per_user_cents is None or hardware_cents is None

    if is_quote:
        amount_cents = None
    else:
        # Due today = setup + hardware + annual prepay (if chosen). Monthly
        # per-user service is billed separately from this one-time link.
        service_cents = per_user_cents * user_count if annual_plan else 0
        amount_cents = ENTERPRISE_SETUP_CENTS + hardware_cents * hardware_quantity + service_cents
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
        title = f"MDM TapCard Enterprise • {user_count} users • {hardware}"
        square_checkout_url, square_payment_link_id = await _create_square_checkout_link(
            amount_cents=amount_cents,
            currency="USD",
            title=title,
        )

    square_customer_id: str | None = None
    square_subscription_id: str | None = None
    subscription_status: str | None = None
    if settings.SQUARE_SUBSCRIPTIONS_ENABLED and not is_quote and per_user_cents is not None:
        service_amount = per_user_cents * user_count
        cadence = "ANNUAL" if annual_plan else "MONTHLY"
        plan_name = f"MDM Enterprise {cadence.title()} {user_count}u ${service_amount / 100:.2f}"
        start_date = _annual_subscription_start() if annual_plan else None
        try:
            square_customer_id, square_subscription_id, subscription_status = await _start_recurring_subscription(
                email=email,
                contact_name=contact_name,
                plan_name=plan_name,
                amount_cents=service_amount,
                cadence=cadence,
                start_date=start_date,
                card_source_id=card_source_id,
            )
        except Exception:
            subscription_status = "error"

    request = SignupRequest(
        company_name=company_name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        plan_interest=f"enterprise_{billing}",
        service_interest=f"enterprise_{hardware}",
        team_size=str(user_count),
        quantity=hardware_quantity or None,
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
        square_customer_id=square_customer_id,
        square_subscription_id=square_subscription_id,
        subscription_status=subscription_status,
        status="enterprise_quote" if is_quote else "enterprise_new",
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    if is_quote:
        shipping_lines = ", ".join(
            filter(None, [shipping_address1, shipping_city, shipping_state, shipping_postal_code, shipping_country])
        )
        await send_email(
            settings.ADMIN_NOTIFICATION_EMAIL,
            f"New enterprise quote request \u2014 {company_name}",
            (
                f"Company: {company_name}\n"
                f"Contact: {contact_name}\n"
                f"Email: {email}\n"
                f"Phone: {phone or '-'}\n"
                f"Users: {user_count}\n"
                f"Billing: {billing}\n"
                f"Hardware: {hardware} x{hardware_quantity}\n"
                f"Shipping: {shipping_lines or '-'}\n"
                f"Notes: {notes or '-'}\n\n"
                f"Request ID: {request.id}\n"
                "Complete this request in the admin Signup Requests queue to quote a price and generate checkout."
            ),
        )

    message = (
        "Thanks! Your enterprise request was received. We'll follow up with custom pricing."
        if is_quote
        else "Thanks! Your enterprise signup request was received."
    )

    return SignupRequestOut(
        request_id=request.id,
        submitted=True,
        message=message,
        payment_required=payment_required,
        checkout_url=square_checkout_url,
        is_design_request=is_quote,
    )
