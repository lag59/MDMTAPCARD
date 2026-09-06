// Reusable Netlify Function for MDM TapCard galleries.
// Copy this to your client website's netlify/functions/ folder.
//
// It keeps the MDM private API key server-side. The website frontend calls
// /.netlify/functions/mdm-gallery — never the MDM API directly.
//
// Required Netlify environment variables:
//   MDM_API_URL         e.g. https://mdm-tapcard-api.fly.dev
//   MDM_API_KEY         e.g. mdm_live_xxxxx  (kept secret, server-side only)
//   MDM_BUSINESS_SLUG   e.g. emv-custom-pools

const CACHE_SECONDS = 300; // 5 minutes at the CDN edge

exports.handler = async (event) => {
  const { MDM_API_URL, MDM_API_KEY, MDM_BUSINESS_SLUG } = process.env;

  if (!MDM_API_URL || !MDM_API_KEY || !MDM_BUSINESS_SLUG) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Gallery is not configured." }),
    };
  }

  // Forward safe, whitelisted query params only.
  const params = new URLSearchParams();
  const allowed = ["limit", "platform", "featured", "category"];
  const incoming = event.queryStringParameters || {};
  for (const key of allowed) {
    if (incoming[key] != null && incoming[key] !== "") params.set(key, incoming[key]);
  }
  const query = params.toString();

  const url =
    `${MDM_API_URL.replace(/\/$/, "")}/api/v1/businesses/${encodeURIComponent(MDM_BUSINESS_SLUG)}/gallery` +
    (query ? `?${query}` : "");

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${MDM_API_KEY}` },
    });

    if (!response.ok) {
      return {
        statusCode: response.status === 404 ? 404 : 502,
        headers: { "Content-Type": "application/json" },
        // Never leak upstream details/tokens to the browser.
        body: JSON.stringify({ error: "Gallery is temporarily unavailable." }),
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
      },
      body: JSON.stringify(data),
    };
  } catch {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Gallery is temporarily unavailable." }),
    };
  }
};
