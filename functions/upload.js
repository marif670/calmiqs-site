// ============================================
// functions/upload.js
// ============================================

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const token = request.headers.get("X-Admin-Token");
  const isAdmin =
    token === "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Hadia@2017_Ayesha@2007";

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const r2Key = `uploads/${timestamp}-${randomId}/${file.name}`;

    await env.R2_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
    });

    const metaKey = `img:${timestamp}-${randomId}`;
    const metadata = {
      r2Key,
      filename: file.name,
      alt: formData.get("alt") || file.name,
      title: formData.get("title") || file.name,
      uploadedAt: new Date().toISOString(),
    };

    await env.CALMIQS_IMAGES.put(metaKey, JSON.stringify(metadata));

    const fileUrl = `${new URL(request.url).origin}/files/${encodeURIComponent(
      r2Key
    )}`;

    return new Response(
      JSON.stringify({
        success: true,
        url: fileUrl,
        r2Key,
        metadata,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}
