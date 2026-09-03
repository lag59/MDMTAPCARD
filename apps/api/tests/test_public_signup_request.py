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

    # (service, requested_quantity, expected_amount, expected_quantity, is_design)
    # Amounts = $49 setup + product(s); the default monthly plan adds nothing today.
    cases = [
        ("digital_only", 4, 4900, 1, False),
        ("pvc_tapcard", 2, 7898, 2, False),
        ("premium_custom_metal", 3, None, 3, True),
        ("tap_button", 2, 6898, 2, False),
    ]
    for service_interest, requested_quantity, expected_amount, expected_quantity, is_design in cases:
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
            assert session.added.amount_cents == expected_amount

    # Only the three non-design services create a Square checkout link.
    assert [call["amount_cents"] for call in calls] == [4900, 7898, 6898]
    assert "digital_only x1" in str(calls[0]["title"])
    assert "tap_button x2" in str(calls[2]["title"])


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
                _signup_body("tap_button", shipping=False),
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
                _signup_body("tap_button"),
                _FakeSession(existing=SignupRequest()),  # type: ignore[arg-type]
            )
        )
    except HTTPException as exc:
        assert exc.status_code == 429
        assert "already submitted recently" in str(exc.detail)
    else:
        raise AssertionError("Duplicate signup should be rejected")

    assert checkout_called is False


def _enterprise_body(
    *,
    user_count: int = 10,
    billing: str = "annual",
    hardware: str = "pvc_tapcard",
    hardware_quantity: int | None = None,
) -> public.EnterpriseSignupIn:
    payload: dict[str, object] = {
        "company_name": "MDM Test Company",
        "contact_name": "Test Customer",
        "email": f"enterprise-{uuid.uuid4().hex[:8]}@example.com",
        "user_count": user_count,
        "billing": billing,
        "hardware": hardware,
        "hardware_quantity": hardware_quantity,
        "shipping_name": "Test Customer",
        "shipping_address1": "123 Test Street",
        "shipping_city": "Austin",
        "shipping_state": "TX",
        "shipping_postal_code": "78701",
        "shipping_country": "us",
    }
    return public.EnterpriseSignupIn(**payload)


def test_enterprise_annual_matches_ten_employee_example(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_checkout(*, amount_cents: int, currency: str, title: str) -> tuple[str, str]:
        captured["amount_cents"] = amount_cents
        return "https://square.test/checkout", "payment-link-id"

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)

    session = _FakeSession()
    response = _run(
        public.submit_enterprise_signup_request(
            _fake_request(),
            _enterprise_body(user_count=10, billing="annual", hardware="pvc_tapcard"),
            session,  # type: ignore[arg-type]
        )
    )

    # $299 setup + 10 x $12.99 card + 10 x $29/yr service = $718.90.
    assert captured["amount_cents"] == 71890
    assert session.added.amount_cents == 71890  # type: ignore[union-attr]
    assert session.added.quantity == 10  # type: ignore[union-attr]
    assert response.payment_required is True  # type: ignore[union-attr]
    assert response.checkout_url == "https://square.test/checkout"  # type: ignore[union-attr]


def test_enterprise_monthly_only_charges_setup_and_hardware(monkeypatch) -> None:
    async def fake_checkout(*, amount_cents: int, currency: str, title: str) -> tuple[str, str]:
        return "https://square.test/checkout", "payment-link-id"

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)

    session = _FakeSession()
    _run(
        public.submit_enterprise_signup_request(
            _fake_request(),
            _enterprise_body(user_count=10, billing="monthly", hardware="pvc_tapcard"),
            session,  # type: ignore[arg-type]
        )
    )

    # $299 setup + 10 x $12.99 card; monthly per-user service billed separately.
    assert session.added.amount_cents == 42890  # type: ignore[union-attr]


def test_enterprise_large_team_is_quoted(monkeypatch) -> None:
    checkout_called = False

    async def fake_checkout(**_kwargs: object) -> tuple[str, str]:
        nonlocal checkout_called
        checkout_called = True
        return "https://square.test/checkout", "payment-link-id"

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)

    async def fake_send_email(*_args: object, **_kwargs: object) -> None:
        return None

    monkeypatch.setattr(public, "send_email", fake_send_email)

    session = _FakeSession()
    response = _run(
        public.submit_enterprise_signup_request(
            _fake_request(),
            _enterprise_body(user_count=150, billing="annual", hardware="pvc_tapcard"),
            session,  # type: ignore[arg-type]
        )
    )

    assert response.payment_required is False  # type: ignore[union-attr]
    assert response.is_design_request is True  # type: ignore[union-attr]
    assert response.checkout_url is None  # type: ignore[union-attr]
    assert session.added.amount_cents is None  # type: ignore[union-attr]
    assert checkout_called is False


def test_enterprise_requires_minimum_users(monkeypatch) -> None:
    async def fake_checkout(**_kwargs: object) -> tuple[str, str]:
        raise AssertionError("checkout should not be created for invalid team size")

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)

    try:
        _run(
            public.submit_enterprise_signup_request(
                _fake_request(),
                _enterprise_body(user_count=5),
                _FakeSession(),  # type: ignore[arg-type]
            )
        )
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "at least 10 users" in str(exc.detail)
    else:
        raise AssertionError("Enterprise signup below the minimum team size should be rejected")


def test_individual_monthly_creates_recurring_subscription(monkeypatch) -> None:
    async def fake_checkout(*, amount_cents: int, currency: str, title: str) -> tuple[str, str]:
        return "https://square.test/checkout", "payment-link-id"

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)
    monkeypatch.setattr(public.settings, "SQUARE_SUBSCRIPTIONS_ENABLED", True)

    captured: dict[str, object] = {}

    async def fake_subscription(*, email, contact_name, plan_name, amount_cents, cadence, start_date, card_source_id=None):
        captured.update(
            {"amount_cents": amount_cents, "cadence": cadence, "start_date": start_date, "plan_name": plan_name}
        )
        return "cust_1", "sub_1", "ACTIVE"

    monkeypatch.setattr(public, "_start_recurring_subscription", fake_subscription)

    session = _FakeSession()
    _run(
        public.submit_signup_request(
            _fake_request(),
            public.SignupRequestIn(
                company_name="MDM Test Company",
                contact_name="Test Customer",
                email=f"sub-{uuid.uuid4().hex[:8]}@example.com",
                service_interest="digital_only",
                plan_interest="essential_monthly",
            ),
            session,  # type: ignore[arg-type]
        )
    )

    # Monthly Essential = $3.99, starts immediately (no future start_date).
    assert captured["amount_cents"] == 399
    assert captured["cadence"] == "MONTHLY"
    assert captured["start_date"] is None
    assert session.added.square_subscription_id == "sub_1"  # type: ignore[union-attr]
    assert session.added.subscription_status == "ACTIVE"  # type: ignore[union-attr]


def test_enterprise_annual_subscription_starts_next_year(monkeypatch) -> None:
    async def fake_checkout(*, amount_cents: int, currency: str, title: str) -> tuple[str, str]:
        return "https://square.test/checkout", "payment-link-id"

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)
    monkeypatch.setattr(public.settings, "SQUARE_SUBSCRIPTIONS_ENABLED", True)

    captured: dict[str, object] = {}

    async def fake_subscription(*, email, contact_name, plan_name, amount_cents, cadence, start_date, card_source_id=None):
        captured.update({"amount_cents": amount_cents, "cadence": cadence, "start_date": start_date})
        return "cust_2", "sub_2", "PENDING"

    monkeypatch.setattr(public, "_start_recurring_subscription", fake_subscription)

    session = _FakeSession()
    _run(
        public.submit_enterprise_signup_request(
            _fake_request(),
            _enterprise_body(user_count=10, billing="annual", hardware="pvc_tapcard"),
            session,  # type: ignore[arg-type]
        )
    )

    # Annual per-user $29 x 10 users = $290/yr, renews next year (future start_date).
    assert captured["amount_cents"] == 29000
    assert captured["cadence"] == "ANNUAL"
    assert captured["start_date"] is not None
    assert session.added.square_subscription_id == "sub_2"  # type: ignore[union-attr]


def test_subscription_failure_does_not_block_signup(monkeypatch) -> None:
    async def fake_checkout(*, amount_cents: int, currency: str, title: str) -> tuple[str, str]:
        return "https://square.test/checkout", "payment-link-id"

    monkeypatch.setattr(public, "_create_square_checkout_link", fake_checkout)
    monkeypatch.setattr(public.settings, "SQUARE_SUBSCRIPTIONS_ENABLED", True)

    async def failing_subscription(**_kwargs: object):
        raise RuntimeError("Square down")

    monkeypatch.setattr(public, "_start_recurring_subscription", failing_subscription)

    session = _FakeSession()
    response = _run(
        public.submit_signup_request(
            _fake_request(),
            public.SignupRequestIn(
                company_name="MDM Test Company",
                contact_name="Test Customer",
                email=f"subfail-{uuid.uuid4().hex[:8]}@example.com",
                service_interest="digital_only",
                plan_interest="essential_monthly",
            ),
            session,  # type: ignore[arg-type]
        )
    )

    # Checkout still succeeds even when subscription creation fails.
    assert response.checkout_url == "https://square.test/checkout"  # type: ignore[union-attr]
    assert session.added.subscription_status == "error"  # type: ignore[union-attr]
    assert session.added.square_subscription_id is None  # type: ignore[union-attr]


def test_start_subscription_with_card_saves_card_on_file(monkeypatch) -> None:
    async def fake_customer(_email: str, _contact_name: str) -> str:
        return "cust_1"

    async def fake_variation(_name: str, _amount: int, _cadence: str) -> str:
        return "var_1"

    async def fake_card(customer_id: str, source_id: str) -> str:
        assert customer_id == "cust_1"
        assert source_id == "card-nonce"
        return "card_1"

    captured: dict[str, object] = {}

    async def fake_request(method: str, path: str, payload: dict | None = None) -> dict:
        captured["path"] = path
        captured["payload"] = payload
        return {"subscription": {"id": "sub_1", "status": "ACTIVE"}}

    monkeypatch.setattr(public, "_ensure_square_customer", fake_customer)
    monkeypatch.setattr(public, "_ensure_subscription_plan_variation", fake_variation)
    monkeypatch.setattr(public, "_create_card_on_file", fake_card)
    monkeypatch.setattr(public, "_square_request", fake_request)

    customer_id, subscription_id, status = _run(
        public._start_recurring_subscription(
            email="buyer@example.com",
            contact_name="Buyer Person",
            plan_name="MDM Essential Monthly $3.99",
            amount_cents=399,
            cadence="MONTHLY",
            start_date=None,
            card_source_id="card-nonce",
        )
    )

    assert customer_id == "cust_1"
    assert subscription_id == "sub_1"
    assert status == "ACTIVE"
    # The saved card is attached so Square auto-charges instead of invoicing.
    assert (captured["payload"] or {}).get("card_id") == "card_1"  # type: ignore[union-attr]

