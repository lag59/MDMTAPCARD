import os
from dataclasses import dataclass

import httpx
import pytest


@dataclass(frozen=True)
class TestConfig:
    base_url: str
    admin_email: str
    admin_password: str
    owner_email: str
    owner_password: str


@pytest.fixture(scope="session")
def cfg() -> TestConfig:
    return TestConfig(
        base_url=os.getenv("API_BASE_URL", "http://localhost:8000"),
        admin_email=os.getenv("API_ADMIN_EMAIL", "admin@mdmcreation.com"),
        admin_password=os.getenv("API_ADMIN_PASSWORD", "ChangeMe123!"),
        owner_email=os.getenv("API_OWNER_EMAIL", "owner@mdmdemo.com"),
        owner_password=os.getenv("API_OWNER_PASSWORD", "ChangeMe123!"),
    )


@pytest.fixture(scope="session")
def client(cfg: TestConfig) -> httpx.Client:
    with httpx.Client(base_url=cfg.base_url, timeout=15.0) as c:
        # Skip test suite if backend is not reachable.
        try:
            health = c.get("/health")
            health.raise_for_status()
        except Exception as exc:  # pragma: no cover
            pytest.skip(f"API is not reachable at {cfg.base_url}: {exc}")
        yield c


def _login_token(client: httpx.Client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    response.raise_for_status()
    data = response.json()
    token = data.get("access_token")
    if not token:
        raise AssertionError("Login response did not contain access_token")
    return token


@pytest.fixture(scope="session")
def admin_token(client: httpx.Client, cfg: TestConfig) -> str:
    return _login_token(client, cfg.admin_email, cfg.admin_password)


@pytest.fixture(scope="session")
def owner_token(client: httpx.Client, cfg: TestConfig) -> str:
    return _login_token(client, cfg.owner_email, cfg.owner_password)
