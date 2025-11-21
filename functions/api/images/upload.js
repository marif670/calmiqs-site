// functions/api/images/upload.js
// Upload images to R2 bucket

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  "Content-Type": "application/json",
};

function isAdmin(request, env) {
  const token = request.headers.get("X-Admin-Token");
  const ADMIN_SECRET =
    env.ADMIN_SECRET ||
    "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Hadia@2017_Ayesha@2007";
  return token && token === ADMIN_SECRET;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!isAdmin(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);

    // R2 key structure: uploads/{timestamp}-{randomId}/{filename}
    const r2Key = `uploads/${timestamp}-${randomId}/${file.name}`;

    console.log(`[UPLOAD] Uploading to R2: ${r2Key}`);

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
      size: arrayBuffer.byteLength,
    };

    await env.CALMIQS_IMAGES.put(metaKey, JSON.stringify(metadata));

    console.log(`[UPLOAD] Metadata stored: ${metaKey}`);

    // Generate URL - using the public R2 domain or pages.dev path
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
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
