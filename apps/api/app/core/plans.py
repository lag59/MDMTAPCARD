"""AutoGallery subscription plan configuration.

Central source of truth for plan limits so they are never scattered across
components. Payment processing is intentionally out of scope here.

Use a configurable ceiling instead of the word "unlimited" (fair-use cap).
"""

FAIR_USE_CEILING = 100_000

PLAN_CONFIG: dict[str, dict] = {
    "starter": {
        "label": "Starter",
        "price_monthly": 49,
        "social_platforms": 1,
        "limits": {
            "imports": 100,
            "ai_calls": 25,
            "rebuilds": 10,
            "gallery_items": 12,
            "website_feeds": 1,
        },
        "features": {"advanced_analytics": False, "netlify_rebuild": False, "priority_sync": False},
    },
    "professional": {
        "label": "Professional",
        "price_monthly": 79,
        "social_platforms": 3,
        "limits": {
            "imports": 500,
            "ai_calls": 100,
            "rebuilds": 50,
            "gallery_items": 30,
            "website_feeds": 1,
        },
        "features": {"advanced_analytics": True, "netlify_rebuild": True, "priority_sync": False},
    },
    "growth": {
        "label": "Growth",
        "price_monthly": 99,
        "social_platforms": 3,
        "limits": {
            # Fair-use ceiling instead of literal "unlimited".
            "imports": FAIR_USE_CEILING,
            "ai_calls": 250,
            "rebuilds": FAIR_USE_CEILING,
            "gallery_items": 60,
            "website_feeds": 5,
        },
        "features": {"advanced_analytics": True, "netlify_rebuild": True, "priority_sync": True},
    },
}

DEFAULT_PLAN = "starter"


def get_plan(plan: str | None) -> dict:
    return PLAN_CONFIG.get((plan or "").lower(), PLAN_CONFIG[DEFAULT_PLAN])


def plan_limits(plan: str | None) -> dict:
    return get_plan(plan)["limits"]
