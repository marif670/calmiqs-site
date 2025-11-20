// ============================================
// functions/list.js
// ============================================

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const token = request.headers.get("X-Admin-Token");
  const isAdmin =
    token === "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Hadia@2017_Ayesha@2007";

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    const images = [];
    const list = await env.CALMIQS_IMAGES.list({ prefix: "img:" });

    console.log("Images in KV:", list.keys.length);

    for (const key of list.keys) {
      const data = await env.CALMIQS_IMAGES.get(key.name);
      if (data) {
        images.push(JSON.parse(data));
      }
    }

    images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return new Response(
      JSON.stringify({
        success: true,
        images,
        total: images.length,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (err) {
    console.error("List error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
