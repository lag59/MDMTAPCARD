"""AI content suggestions for imported media (Phase 3).

Suggestions are advisory only — they are stored in ai_* columns and must be
explicitly applied by a human before they touch the published fields.

Providers:
- "heuristic" (default): no external calls; derives sensible title/category/alt
  from the existing caption. Always available.
- "openai": uses the Chat Completions API when OPENAI_API_KEY is set.
"""

import json
import logging
import re

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _heuristic(caption: str | None, platform: str) -> dict:
    text = (caption or "").strip()
    words = re.findall(r"[A-Za-z0-9']+", text)
    title = " ".join(words[:8]).title() if words else f"{platform.title()} Post"
    # Very light category guess from common trade keywords.
    lowered = text.lower()
    category = None
    for key in ("pool", "renovation", "restoration", "landscape", "patio", "deck", "kitchen", "bathroom", "roof"):
        if key in lowered:
            category = key
            break
    alt = text[:120] if text else f"{platform.title()} media post"
    return {
        "title": title[:120],
        "category": category,
        "alt_text": alt,
        "caption": text[:200] or title,
    }


async def _openai(caption: str | None, platform: str) -> dict:
    prompt = (
        "You write concise, SEO-friendly metadata for a small-business website gallery. "
        "Given a social caption, return JSON with keys title, category, alt_text, caption. "
        "Keep title under 60 chars, alt_text descriptive under 125 chars, caption under 200 chars, "
        "category a short lowercase slug.\n\n"
        f"Platform: {platform}\nCaption: {caption or '(none)'}"
    )
    async with httpx.AsyncClient(timeout=25.0) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            json={
                "model": settings.AI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.4,
            },
        )
    if res.status_code >= 400:
        raise RuntimeError("AI provider error")
    content = res.json()["choices"][0]["message"]["content"]
    data = json.loads(content)
    return {
        "title": (data.get("title") or "")[:120],
        "category": (data.get("category") or None),
        "alt_text": (data.get("alt_text") or "")[:200],
        "caption": (data.get("caption") or "")[:200],
    }


async def suggest(caption: str | None, platform: str) -> dict:
    provider = (settings.AI_PROVIDER or "heuristic").strip().lower()
    if provider == "openai" and settings.OPENAI_API_KEY:
        try:
            return await _openai(caption, platform)
        except Exception:
            logger.exception("OpenAI suggestion failed; falling back to heuristic")
    return _heuristic(caption, platform)
