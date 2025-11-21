// functions/api/images/upload.js

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

  // Auth check
  const token = request.headers.get("X-Admin-Token");
  const ADMIN_SECRET =
    env.ADMIN_SECRET ||
    "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Hadia@2017_Ayesha@2007";

  if (!token || token !== ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);

    // R2 key structure: uploads/{timestamp}-{randomId}/{filename}
    const r2Key = `uploads/${timestamp}-${randomId}/${file.name}`;

    // Upload to R2
    await env.R2_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
    });

    // Save metadata to KV
    const metaKey = `img:${timestamp}-${randomId}`;
    const metadata = {
      r2Key,
      filename: file.name,
      alt: formData.get("alt") || file.name,
      title: formData.get("title") || file.name,
      uploadedAt: new Date().toISOString(),
    };

    await env.CALMIQS_IMAGES.put(metaKey, JSON.stringify(metadata));

    // Generate accessible URL
    // For R2, you need to use: https://YOUR-R2-DOMAIN/KEY or pub.r2.dev public URL
    const publicUrl = `https://calmiqs-site.pages.dev/files/${encodeURIComponent(
      r2Key
    )}`;

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        r2Key,
        metadata,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
