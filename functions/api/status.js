// functions/api/status.js
// Health check endpoint

export async function onRequestGet(context) {
  const { env } = context;

  return new Response(
    JSON.stringify({
      status: "ok",
      service: "calmiqs-api",
      timestamp: new Date().toISOString(),
      env: {
        hasKV: !!env.CALMIQS_POSTS,
        hasR2: !!env.R2_BUCKET,
      },
      endpoints: [
        "GET /api/status",
        "GET /api/posts",
        "POST /api/posts",
        "GET /api/comments/:postSlug",
        "POST /api/comments",
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
