"""Social OAuth + media fetch (Phase 2).

Server-side authorization-code flow for Facebook, Instagram (via Facebook
Login), and TikTok. Tokens are never exposed to the browser; OAuth state is
signed (CSRF protection) and short-lived. Media fetch normalizes each platform's
response into NormalizedItem for the sync service.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
import jwt

from app.config import settings
from app.models.social import ConnectionStatus, MediaType, SocialConnection, SocialPlatform
from app.utils.crypto import decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

_STATE_TTL_SECONDS = 600


class OAuthError(Exception):
    pass


@dataclass
class NormalizedItem:
    external_media_id: str
    media_type: MediaType
    media_url: str | None
    thumbnail_url: str | None
    caption: str | None
    post_url: str | None
    published_at: datetime | None


@dataclass
class ExchangeResult:
    platform_account_id: str
    platform_username: str | None
    access_token: str
    refresh_token: str | None
    token_expires_at: datetime | None
    scopes: str | None


def _redirect_uri(platform: SocialPlatform) -> str:
    return f"{settings.APP_BASE_URL.rstrip('/')}/api/v1/social/oauth/{platform.value}/callback"


def _fb_creds(platform: SocialPlatform) -> tuple[str, str]:
    if platform == SocialPlatform.instagram and settings.INSTAGRAM_CLIENT_ID:
        return settings.INSTAGRAM_CLIENT_ID, settings.INSTAGRAM_CLIENT_SECRET
    return settings.FACEBOOK_CLIENT_ID, settings.FACEBOOK_CLIENT_SECRET


def is_configured(platform: SocialPlatform) -> bool:
    if platform in (SocialPlatform.facebook, SocialPlatform.instagram):
        cid, secret = _fb_creds(platform)
        return bool(cid and secret)
    if platform == SocialPlatform.tiktok:
        return bool(settings.TIKTOK_CLIENT_KEY and settings.TIKTOK_CLIENT_SECRET)
    return False


# ── Signed OAuth state (CSRF) ────────────────────────────────────────────────

def make_state(tenant_id, business_id, platform: SocialPlatform) -> str:
    payload = {
        "tenant_id": str(tenant_id),
        "business_id": str(business_id),
        "platform": platform.value,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=_STATE_TTL_SECONDS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def read_state(state: str) -> dict:
    try:
        return jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise OAuthError("Invalid or expired OAuth state") from exc


# ── Authorization URLs ───────────────────────────────────────────────────────

def build_authorize_url(platform: SocialPlatform, state: str) -> str:
    if not is_configured(platform):
        raise OAuthError(f"{platform.value} OAuth is not configured")
    redirect = _redirect_uri(platform)

    if platform in (SocialPlatform.facebook, SocialPlatform.instagram):
        cid, _ = _fb_creds(platform)
        scope = (
            "instagram_basic,pages_show_list,pages_read_engagement"
            if platform == SocialPlatform.instagram
            else "pages_show_list,pages_read_engagement,pages_read_user_content"
        )
        v = settings.FACEBOOK_GRAPH_VERSION
        return (
            f"https://www.facebook.com/{v}/dialog/oauth?client_id={cid}"
            f"&redirect_uri={redirect}&state={state}&response_type=code&scope={scope}"
        )

    if platform == SocialPlatform.tiktok:
        return (
            "https://www.tiktok.com/v2/auth/authorize/"
            f"?client_key={settings.TIKTOK_CLIENT_KEY}"
            "&scope=user.info.basic,video.list&response_type=code"
            f"&redirect_uri={redirect}&state={state}"
        )

    raise OAuthError(f"Unsupported platform {platform.value}")


# ── Code exchange ────────────────────────────────────────────────────────────

async def exchange_code(platform: SocialPlatform, code: str) -> ExchangeResult:
    if platform in (SocialPlatform.facebook, SocialPlatform.instagram):
        return await _exchange_facebook(platform, code)
    if platform == SocialPlatform.tiktok:
        return await _exchange_tiktok(code)
    raise OAuthError(f"Unsupported platform {platform.value}")


async def _exchange_facebook(platform: SocialPlatform, code: str) -> ExchangeResult:
    cid, secret = _fb_creds(platform)
    v = settings.FACEBOOK_GRAPH_VERSION
    base = f"https://graph.facebook.com/{v}"
    redirect = _redirect_uri(platform)

    async with httpx.AsyncClient(timeout=20.0) as client:
        token_res = await client.get(
            f"{base}/oauth/access_token",
            params={"client_id": cid, "client_secret": secret, "redirect_uri": redirect, "code": code},
        )
        if token_res.status_code >= 400:
            raise OAuthError("Facebook token exchange failed")
        short_lived = token_res.json().get("access_token")

        # Upgrade to a long-lived user token.
        ll_res = await client.get(
            f"{base}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": cid,
                "client_secret": secret,
                "fb_exchange_token": short_lived,
            },
        )
        user_token = ll_res.json().get("access_token", short_lived)

        pages_res = await client.get(
            f"{base}/me/accounts",
            params={"fields": "name,access_token,instagram_business_account{id,username}", "access_token": user_token},
        )
        pages = pages_res.json().get("data", [])
        if not pages:
            raise OAuthError("No Facebook Pages found for this account")

        if platform == SocialPlatform.instagram:
            page = next((p for p in pages if p.get("instagram_business_account")), None)
            if not page:
                raise OAuthError("No Instagram business account linked to a Facebook Page")
            ig = page["instagram_business_account"]
            return ExchangeResult(
                platform_account_id=ig["id"],
                platform_username=ig.get("username"),
                access_token=page["access_token"],
                refresh_token=None,
                token_expires_at=None,
                scopes="instagram_basic,pages_show_list",
            )

        page = pages[0]
        return ExchangeResult(
            platform_account_id=page["id"],
            platform_username=page.get("name"),
            access_token=page["access_token"],
            refresh_token=None,
            token_expires_at=None,
            scopes="pages_read_engagement,pages_read_user_content",
        )


async def _exchange_tiktok(code: str) -> ExchangeResult:
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            "https://open.tiktokapis.com/v2/oauth/token/",
            data={
                "client_key": settings.TIKTOK_CLIENT_KEY,
                "client_secret": settings.TIKTOK_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": _redirect_uri(SocialPlatform.tiktok),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        data = res.json()
        if res.status_code >= 400 or not data.get("access_token"):
            raise OAuthError("TikTok token exchange failed")
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=int(data["expires_in"]))
            if data.get("expires_in")
            else None
        )
        return ExchangeResult(
            platform_account_id=data.get("open_id", "tiktok"),
            platform_username=None,
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            token_expires_at=expires_at,
            scopes=data.get("scope"),
        )


# ── Token refresh ────────────────────────────────────────────────────────────

async def refresh_if_needed(connection: SocialConnection) -> None:
    """Refresh TikTok tokens near expiry. Facebook page tokens are long-lived."""
    if connection.platform != SocialPlatform.tiktok:
        return
    if not connection.token_expires_at:
        return
    if connection.token_expires_at - datetime.now(timezone.utc) > timedelta(minutes=10):
        return
    refresh = decrypt_token(connection.refresh_token_encrypted or "")
    if not refresh:
        connection.status = ConnectionStatus.expired
        return

    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            "https://open.tiktokapis.com/v2/oauth/token/",
            data={
                "client_key": settings.TIKTOK_CLIENT_KEY,
                "client_secret": settings.TIKTOK_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": refresh,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        data = res.json()
        if res.status_code >= 400 or not data.get("access_token"):
            connection.status = ConnectionStatus.expired
            return
        connection.access_token_encrypted = encrypt_token(data["access_token"])
        if data.get("refresh_token"):
            connection.refresh_token_encrypted = encrypt_token(data["refresh_token"])
        if data.get("expires_in"):
            connection.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(data["expires_in"]))


# ── Media fetch + normalization ──────────────────────────────────────────────

async def fetch_media(connection: SocialConnection, limit: int = 25) -> list[NormalizedItem]:
    token = decrypt_token(connection.access_token_encrypted or "")
    if not token:
        raise OAuthError("Missing access token")

    if connection.platform == SocialPlatform.instagram:
        return await _fetch_instagram(connection, token, limit)
    if connection.platform == SocialPlatform.facebook:
        return await _fetch_facebook(connection, token, limit)
    if connection.platform == SocialPlatform.tiktok:
        return await _fetch_tiktok(token, limit)
    return []


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def _fetch_instagram(connection: SocialConnection, token: str, limit: int) -> list[NormalizedItem]:
    v = settings.FACEBOOK_GRAPH_VERSION
    url = f"https://graph.facebook.com/{v}/{connection.platform_account_id}/media"
    fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp"
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(url, params={"fields": fields, "limit": limit, "access_token": token})
    if res.status_code >= 400:
        raise OAuthError("Instagram media fetch failed")
    items: list[NormalizedItem] = []
    for m in res.json().get("data", []):
        mt = MediaType.video if m.get("media_type") == "VIDEO" else MediaType.image
        items.append(
            NormalizedItem(
                external_media_id=m["id"],
                media_type=mt,
                media_url=m.get("media_url"),
                thumbnail_url=m.get("thumbnail_url") or m.get("media_url"),
                caption=m.get("caption"),
                post_url=m.get("permalink"),
                published_at=_parse_iso(m.get("timestamp")),
            )
        )
    return items


async def _fetch_facebook(connection: SocialConnection, token: str, limit: int) -> list[NormalizedItem]:
    v = settings.FACEBOOK_GRAPH_VERSION
    url = f"https://graph.facebook.com/{v}/{connection.platform_account_id}/photos"
    fields = "id,images,name,link,created_time"
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(url, params={"type": "uploaded", "fields": fields, "limit": limit, "access_token": token})
    if res.status_code >= 400:
        raise OAuthError("Facebook media fetch failed")
    items: list[NormalizedItem] = []
    for m in res.json().get("data", []):
        images = m.get("images") or []
        full = images[0]["source"] if images else None
        thumb = images[-1]["source"] if images else full
        items.append(
            NormalizedItem(
                external_media_id=m["id"],
                media_type=MediaType.image,
                media_url=full,
                thumbnail_url=thumb,
                caption=m.get("name"),
                post_url=m.get("link"),
                published_at=_parse_iso(m.get("created_time")),
            )
        )
    return items


async def _fetch_tiktok(token: str, limit: int) -> list[NormalizedItem]:
    url = "https://open.tiktokapis.com/v2/video/list/"
    fields = "id,title,cover_image_url,share_url,create_time"
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{url}?fields={fields}",
            json={"max_count": min(limit, 20)},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if res.status_code >= 400:
        raise OAuthError("TikTok media fetch failed")
    videos = (res.json().get("data") or {}).get("videos", [])
    items: list[NormalizedItem] = []
    for m in videos:
        published = (
            datetime.fromtimestamp(int(m["create_time"]), tz=timezone.utc) if m.get("create_time") else None
        )
        items.append(
            NormalizedItem(
                external_media_id=str(m["id"]),
                media_type=MediaType.video,
                media_url=m.get("cover_image_url"),
                thumbnail_url=m.get("cover_image_url"),
                caption=m.get("title"),
                post_url=m.get("share_url"),
                published_at=published,
            )
        )
    return items
