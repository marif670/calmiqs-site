// functions/api/affiliate/redirect.js - Affiliate link tracker

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const affiliateId = url.searchParams.get("id");
  const redirect = url.searchParams.get("url");

  if (!affiliateId || !redirect) {
    return new Response("Invalid affiliate link", { status: 400 });
  }

  try {
    // Log click to KV for tracking
    const timestamp = Date.now();
    const logKey = `aff:${affiliateId}:${timestamp}`;

    await env.CALMIQS_POSTS.put(
      logKey,
      JSON.stringify({
        affiliateId,
        timestamp,
        ip: request.headers.get("CF-Connecting-IP"),
        userAgent: request.headers.get("User-Agent"),
        referer: request.headers.get("Referer"),
      })
    );

    // Redirect to affiliate link
    return new Response(null, {
      status: 302,
      headers: {
        Location: decodeURIComponent(redirect),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Affiliate redirect error:", error);
    return new Response("Redirect error", { status: 500 });
  }
}
