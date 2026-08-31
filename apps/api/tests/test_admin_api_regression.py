import uuid

import httpx


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_profile(client: httpx.Client, token: str, display_name: str, card_type: str) -> str:
    response = client.post(
        "/api/v1/profiles/",
        headers=_auth_headers(token),
        json={
            "display_name": display_name,
            "card_type": card_type,
            "social_links": [],
        },
    )
    response.raise_for_status()
    payload = response.json()
    profile_id = payload.get("id")
    assert profile_id
    return str(profile_id)


def test_dashboard_role_access(client: httpx.Client, admin_token: str, owner_token: str) -> None:
    admin_resp = client.get("/api/v1/admin/dashboard", headers=_auth_headers(admin_token))
    assert admin_resp.status_code == 200

    owner_resp = client.get("/api/v1/admin/dashboard", headers=_auth_headers(owner_token))
    assert owner_resp.status_code == 403


def test_owner_cannot_create_profile_with_custom_template_code(client: httpx.Client, owner_token: str) -> None:
    response = client.post(
        "/api/v1/profiles/",
        headers=_auth_headers(owner_token),
        json={
            "display_name": f"Custom Template {uuid.uuid4().hex[:6]}",
            "theme_id": "custom",
            "custom_theme": '{"layout":"classic","palette":{}}',
        },
    )

    assert response.status_code == 403
    assert response.json().get("detail") == "Only super admins can create profiles with custom template code."


def test_create_user_with_invalid_company_returns_404(client: httpx.Client, admin_token: str) -> None:
    random_company_id = str(uuid.uuid4())
    email = f"regression-{uuid.uuid4().hex[:8]}@example.com"

    response = client.post(
        "/api/v1/admin/users",
        headers=_auth_headers(admin_token),
        json={
            "name": "Regression Invalid Company",
            "email": email,
            "password": "ChangeMe123!",
            "role": "employee",
            "company_id": random_company_id,
        },
    )

    assert response.status_code == 404
    assert response.json().get("detail") == "Company not found"


def test_orders_summary_shape_and_revenue_type(client: httpx.Client, admin_token: str) -> None:
    response = client.get("/api/v1/admin/orders", headers=_auth_headers(admin_token))
    assert response.status_code == 200

    payload = response.json()
    assert "items" in payload
    assert "summary" in payload

    summary = payload["summary"]
    for key in ("total_orders", "pending", "paid", "cancelled", "refunded", "revenue_cents"):
        assert key in summary
        assert isinstance(summary[key], int)


def test_analytics_overview_shape(client: httpx.Client, owner_token: str) -> None:
    response = client.get("/api/v1/admin/analytics/overview", headers=_auth_headers(owner_token))
    assert response.status_code == 200

    payload = response.json()
    for key in ("total_taps", "total_leads", "conversion_rate", "by_event_type", "daily"):
        assert key in payload

    assert isinstance(payload["total_taps"], int)
    assert isinstance(payload["total_leads"], int)
    assert isinstance(payload["conversion_rate"], (int, float))
    assert isinstance(payload["by_event_type"], dict)
    assert isinstance(payload["daily"], list)


def test_canonical_prepare_tag_endpoint_exists(client: httpx.Client, admin_token: str) -> None:
    # A random profile UUID should pass routing/auth and fail with profile not found.
    random_profile_id = str(uuid.uuid4())
    response = client.post(
        f"/api/v1/profiles/{random_profile_id}/tags/prepare",
        headers=_auth_headers(admin_token),
    )

    assert response.status_code == 404
    assert response.json().get("detail") == "Profile not found"


def test_canonical_confirm_tag_endpoint_exists(client: httpx.Client, admin_token: str) -> None:
    # A random tag UUID should pass routing/auth and fail with tag not found.
    random_tag_id = str(uuid.uuid4())
    response = client.post(
        f"/api/v1/tags/{random_tag_id}/confirm",
        headers=_auth_headers(admin_token),
        json={"verified_url": "https://example.com/c/demo?tag=demo"},
    )

    assert response.status_code == 404
    assert response.json().get("detail") == "Tag not found"


def test_grant_complimentary_nfc_missing_company_returns_404(client: httpx.Client, admin_token: str) -> None:
    random_company_id = str(uuid.uuid4())
    response = client.post(
        f"/api/v1/admin/companies/{random_company_id}/complimentary-nfc",
        headers=_auth_headers(admin_token),
        json={"quantity": 1},
    )

    assert response.status_code == 404
    assert response.json().get("detail") == "Company not found"


def test_square_checkout_endpoint_exists_for_unknown_order(client: httpx.Client, admin_token: str) -> None:
    random_order_id = str(uuid.uuid4())
    response = client.post(
        f"/api/v1/admin/orders/{random_order_id}/square-checkout",
        headers=_auth_headers(admin_token),
        json={},
    )

    assert response.status_code == 404
    assert response.json().get("detail") == "Order not found"


def test_prepare_nfc_rejects_digital_only_profile(client: httpx.Client, owner_token: str) -> None:
    profile_id = _create_profile(
        client,
        owner_token,
        display_name=f"Regression Digital {uuid.uuid4().hex[:6]}",
        card_type="digital_only",
    )

    response = client.post(
        f"/api/v1/profiles/{profile_id}/nfc/prepare",
        headers=_auth_headers(owner_token),
    )

    assert response.status_code == 400
    assert response.json().get("detail") == "This digital-only profile does not require NFC programming."


def test_prepare_nfc_allows_button_profiles(client: httpx.Client, owner_token: str) -> None:
    profile_id = _create_profile(
        client,
        owner_token,
        display_name=f"Regression Button {uuid.uuid4().hex[:6]}",
        card_type="nfc_button",
    )

    response = client.post(
        f"/api/v1/profiles/{profile_id}/nfc/prepare",
        headers=_auth_headers(owner_token),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload.get("profile_id") == profile_id
    assert payload.get("hardware_type") == "button"
    assert isinstance(payload.get("profile_url"), str)
    assert "/t/" in payload["profile_url"]
