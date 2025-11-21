// functions/api/images/serve.js - Serve files from R2

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const r2Key =
    url.searchParams.get("key") || url.pathname.replace("/files/", "");

  if (!r2Key) {
    return new Response("No file specified", { status: 400 });
  }

  try {
    // Decode if URL-encoded
    const decodedKey = decodeURIComponent(r2Key);

    // Fetch from R2
    const file = await env.R2_BUCKET.get(decodedKey);

    if (!file) {
      return new Response("File not found", { status: 404 });
    }

    // Determine MIME type
    const mimeType =
      file.httpMetadata?.contentType || "application/octet-stream";

    // Return file with proper headers
    return new Response(file.body, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": file.size,
      },
    });
  } catch (error) {
    console.error("Serve error:", error);
    return new Response("Server error", { status: 500 });
  }
}
