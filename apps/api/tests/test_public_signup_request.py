import asyncio
import uuid

from fastapi import HTTPException, Request

from app.models.signup_request import SignupRequest
from app.routers import public


def _fake_request() -> Request:
    # Unique client IP per call so the per-IP rate limiter does not accumulate
    # state across independent test cases in the same process.
    client_host = f"10.0.{uuid.uuid4().int % 256}.{uuid.uuid4().int % 256}"
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/public/signup-request",
        "headers": [],
        "client": (client_host, 0),
        "server": ("testserver", 80),
        "query_string": b"",
        "scheme": "http",
    }
    return Request(scope)


class _ScalarResult:
    def __init__(self, existing: SignupRequest | None = None) -> None:
        self.existing = existing

    def scalar_one_or_none(self) -> SignupRequest | None:
        return self.existing


class _FakeSession:
    def __init__(self, existing: SignupRequest | None = None) -> None:
        self.existing = existing
        self.added: SignupRequest | None = None
        self.committed = False

    async def execute(self, _query: object) -> _ScalarResult:
        return _ScalarResult(self.existing)

    def add(self, request: SignupRequest) -> None:
        self.added = request

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, request: SignupRequest) -> None:
        request.id = uuid.uuid4()


def _signup_body(service_interest: str, *, quantity: int = 1, shipping: bool = True) -> public.SignupRequestIn:
    payload: dict[str, object] = {
        "company_name": "MDM Test Company",
        "contact_name": "Test Customer",
        "email": f"{service_interest}-{uuid.uuid4().hex[:8]}@example.com",
        "service_interest": service_interest,
        "quantity": quantity,
    }
    if shipping:
        payload.update(
            {
                "shipping_name": "Test Customer",
                "shipping_address1": "123 Test Street",
                "shipping_city": "Austin",
                "shipping_state": "TX",
                "shipping_postal_code": "78701",
                "shipping_country": "us",
            }
        )
    return public.SignupRequestIn(**payload)


def _run(coroutine: object) -> object:
    return asyncio.run(coroutine)  # type: ignore[arg-type]


def test_signup_creates_mocked_checkout_for_each_service(monkeypatch) -> None:
    calls: list[dict[str, object]] = []

    async def fake_checkout(*, amount_cents: int, currency: str, title: str) -> tuple[str, str]:
        calls.append({"amount_cents": amount_cents, "currency": currency, "title": title})
        return "https://square.test/checkout", "payment-link-id"

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)

    async def fake_send_email(*_args: object, **_kwargs: object) -> None:
        return None

    monkeypatch.setattr(public, "send_email", fake_send_email)

    # (service, requested_quantity, unit_price, expected_quantity, is_design)
    cases = [
        ("digital_card", 4, 399, 1, False),
        ("physical_tap_card", 2, 9900, 2, False),
        ("physical_tap_card_with_design", 3, 14900, 3, True),
        ("tap_button_for_phone", 2, 7900, 2, False),
    ]
    for service_interest, requested_quantity, unit_price, expected_quantity, is_design in cases:
        session = _FakeSession()
        response = _run(
            public.submit_signup_request(
                _fake_request(),
                _signup_body(service_interest, quantity=requested_quantity),
                session,  # type: ignore[arg-type]
            )
        )

        assert session.committed is True
        assert session.added is not None
        assert session.added.quantity == expected_quantity
        assert session.added.shipping_country == "US"

        if is_design:
            # Custom-design orders are quoted manually, so they skip checkout.
            assert response.payment_required is False  # type: ignore[union-attr]
            assert response.is_design_request is True  # type: ignore[union-attr]
            assert response.checkout_url is None  # type: ignore[union-attr]
            assert session.added.amount_cents is None
        else:
            assert response.payment_required is True  # type: ignore[union-attr]
            assert response.checkout_url == "https://square.test/checkout"  # type: ignore[union-attr]
            assert session.added.amount_cents == unit_price * expected_quantity

    # Only the three non-design services create a Square checkout link.
    assert [call["amount_cents"] for call in calls] == [399, 19800, 15800]
    assert "digital_card x1" in str(calls[0]["title"])
    assert "tap_button_for_phone x2" in str(calls[2]["title"])


def test_tap_button_requires_shipping_before_checkout(monkeypatch) -> None:
    checkout_called = False

    async def fake_checkout(**_kwargs: object) -> tuple[str, str]:
        nonlocal checkout_called
        checkout_called = True
        return "https://square.test/checkout", "payment-link-id"

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)

    try:
        _run(
            public.submit_signup_request(
                _fake_request(),
                _signup_body("tap_button_for_phone", shipping=False),
                _FakeSession(),  # type: ignore[arg-type]
            )
        )
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "Missing shipping fields" in str(exc.detail)
    else:
        raise AssertionError("TapButton signup without shipping details should be rejected")

    assert checkout_called is False


def test_duplicate_signup_does_not_create_checkout(monkeypatch) -> None:
    checkout_called = False

    async def fake_checkout(**_kwargs: object) -> tuple[str, str]:
        nonlocal checkout_called
        checkout_called = True
        return "https://square.test/checkout", "payment-link-id"

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)

    try:
        _run(
            public.submit_signup_request(
                _fake_request(),
                _signup_body("tap_button_for_phone"),
                _FakeSession(existing=SignupRequest()),  # type: ignore[arg-type]
            )
        )
    except HTTPException as exc:
        assert exc.status_code == 429
        assert "already submitted recently" in str(exc.detail)
    else:
        raise AssertionError("Duplicate signup should be rejected")

    assert checkout_called is False
