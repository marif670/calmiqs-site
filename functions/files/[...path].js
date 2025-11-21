// functions/files/[...path].js
// Serve files from R2 bucket

export async function onRequest(context) {
  const { request, env, params } = context;

  // Get the file path from URL
  const filePath = params.path.join("/");

  if (!filePath) {
    return new Response("No file specified", { status: 400 });
  }

  try {
    // Decode URL-encoded path
    const decodedPath = decodeURIComponent(filePath);

    console.log(`[SERVE] Fetching from R2: ${decodedPath}`);

    // Fetch from R2
    const file = await env.R2_BUCKET.get(decodedPath);

    if (!file) {
      console.log(`[SERVE] File not found: ${decodedPath}`);
      return new Response("File not found", { status: 404 });
    }

    // Determine MIME type
    const mimeType =
      file.httpMetadata?.contentType || "application/octet-stream";

    console.log(`[SERVE] Serving file with type: ${mimeType}`);

    // Return file with proper caching headers
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
